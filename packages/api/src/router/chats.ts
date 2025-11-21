import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  agent,
  and,
  asc,
  chat,
  chatParticipant,
  contact,
  count,
  department,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  message,
  or,
  organization,
  sql,
  user,
} from "@manylead/db";
import { publishChatEvent, formatTime, formatDateTime, calculateDuration } from "@manylead/shared";

import { env } from "../env";
import {
  createTRPCRouter,
  memberProcedure,
  ownerProcedure,
} from "../trpc";

/**
 * Chats Router
 *
 * Gerencia conversas (chats) do tenant - WhatsApp e internos
 */
export const chatsRouter = createTRPCRouter({
  /**
   * Listar chats com filtros e paginação
   */
  list: memberProcedure
    .input(
      z.object({
        status: z.enum(["open", "pending", "closed", "snoozed"]).optional(),
        assignedTo: z.string().uuid().optional(),
        departmentId: z.string().uuid().optional(),
        messageSource: z.enum(["whatsapp", "internal"]).optional(),
        search: z.string().optional(),
        unreadOnly: z.boolean().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { status, assignedTo, departmentId, messageSource, search, unreadOnly, limit, offset } =
        input;

      // Buscar o agent do usuário atual
      const [currentAgent] = await ctx.tenantDb
        .select()
        .from(agent)
        .where(eq(agent.userId, ctx.session.user.id))
        .limit(1);

      // Construir where conditions
      const conditions = [];

      // Lógica de visibilidade:
      // 1. Chat pending (cross-org): aparece para TODOS (qualquer agent pode pegar)
      // 2. Chat com mensagens: aparece para TODOS
      // 3. Chat sem mensagens e não pending: só aparece para assigned agent
      conditions.push(
        or(
          eq(chat.status, "pending"), // Chats pending aparecem para todos
          sql`${chat.totalMessages} > 0`, // Chats com mensagens aparecem para todos
          currentAgent ? eq(chat.assignedTo, currentAgent.id) : undefined, // Ou atribuído a mim
        ),
      );

      // Filtro de departamento baseado em permissões do agent
      if (currentAgent?.permissions.departments) {
        const deptPermissions = currentAgent.permissions.departments;

        // Se for "specific", aplica 3 regras:
        // 1. Chats do(s) departamento(s) permitido(s)
        // 2. OU chats atribuídos a mim (mesmo que de outro departamento)
        // 3. OU chats sem departamento (ainda não atribuídos)
        if (
          deptPermissions.type === "specific" &&
          deptPermissions.ids &&
          deptPermissions.ids.length > 0
        ) {
          const departmentFilter = or(
            inArray(chat.departmentId, deptPermissions.ids),
            eq(chat.assignedTo, currentAgent.id),
            isNull(chat.departmentId),
          );
          if (departmentFilter) {
            conditions.push(departmentFilter);
          }
        }
        // Se for "all", não adiciona filtro (vê todos)
      }

      if (status) {
        conditions.push(eq(chat.status, status));
      }

      if (assignedTo) {
        conditions.push(eq(chat.assignedTo, assignedTo));
      }

      if (departmentId) {
        conditions.push(eq(chat.departmentId, departmentId));
      }

      if (messageSource) {
        conditions.push(eq(chat.messageSource, messageSource));
      }

      // Busca em nome do contato e telefone
      if (search) {
        conditions.push(
          or(
            ilike(contact.name, `%${search}%`),
            ilike(contact.phoneNumber, `%${search}%`),
          ),
        );
      }

      // Filtrar apenas conversas com mensagens não lidas
      // IMPORTANTE: Agora filtra baseado em chatParticipant.unreadCount
      if (unreadOnly && currentAgent) {
        conditions.push(sql`${chatParticipant.unreadCount} > 0`);
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      // Executar queries em paralelo
      const [items, totalResult] = await Promise.all([
        ctx.tenantDb
          .select({
            chat,
            contact,
            assignedAgent: agent,
            // Pegar unreadCount do participant (NULL se não for participant)
            participant: chatParticipant,
          })
          .from(chat)
          .leftJoin(contact, eq(chat.contactId, contact.id))
          .leftJoin(agent, eq(chat.assignedTo, agent.id))
          // JOIN com participant APENAS se tiver currentAgent
          .leftJoin(
            chatParticipant,
            currentAgent
              ? and(
                  eq(chatParticipant.chatId, chat.id),
                  eq(chatParticipant.chatCreatedAt, chat.createdAt),
                  eq(chatParticipant.agentId, currentAgent.id),
                )
              : undefined,
          )
          .where(where)
          .limit(limit)
          .offset(offset)
          .orderBy(desc(chat.lastMessageAt)),
        // Query de count precisa do JOIN quando há busca por contact
        search
          ? ctx.tenantDb
              .select({ count: count() })
              .from(chat)
              .leftJoin(contact, eq(chat.contactId, contact.id))
              .where(where)
          : ctx.tenantDb.select({ count: count() }).from(chat).where(where),
      ]);

      // BATCH OPTIMIZATION: Resolver "outro participante" para chats internos
      // Coletar IDs únicos de initiators que precisam ser buscados
      const initiatorAgentIds = [
        ...new Set(
          items
            .map((i) => {
              if (
                i.chat.messageSource === "internal" &&
                i.chat.initiatorAgentId &&
                i.chat.initiatorAgentId !== currentAgent?.id
              ) {
                return i.chat.initiatorAgentId;
              }
              return null;
            })
            .filter((id): id is string => id !== null),
        ),
      ];

      // Se não tem nenhum para resolver, mapear unreadCount e retornar
      if (initiatorAgentIds.length === 0) {
        const itemsWithCorrectUnreadCount = items.map((item) => ({
          ...item,
          chat: {
            ...item.chat,
            unreadCount: item.participant?.unreadCount ?? item.chat.unreadCount,
          },
        }));

        return { items: itemsWithCorrectUnreadCount, total: totalResult[0]?.count ?? 0, limit, offset };
      }

      // Buscar TODOS initiator agents (1 query ao invés de N)
      const initiatorAgents = await ctx.tenantDb
        .select()
        .from(agent)
        .where(inArray(agent.id, initiatorAgentIds));

      // Buscar TODOS initiator users (1 query no catalog)
      const initiatorUserIds = initiatorAgents.map((a) => a.userId);
      const initiatorUsers = await ctx.db
        .select()
        .from(user)
        .where(inArray(user.id, initiatorUserIds));

      // Maps para lookup O(1) - muito mais rápido que Array.find()
      const agentMap = new Map(initiatorAgents.map((a) => [a.id, a]));
      const userMap = new Map(initiatorUsers.map((u) => [u.id, u]));

      // Resolver contatos (100% síncrono!)
      const resolvedItems = items.map((item) => {
        // WhatsApp ou sem current agent: retorna contact normal
        if (item.chat.messageSource !== "internal" || !currentAgent) {
          return item;
        }

        // Chat CROSS-ORG: não substituir contact (já representa a org target)
        if (item.contact?.metadata?.targetOrganizationId) {
          return item;
        }

        // Usuário é INICIADOR: retorna contact (target)
        if (item.chat.initiatorAgentId === currentAgent.id) {
          return item;
        }

        // Usuário é TARGET: buscar initiator nos Maps
        if (!item.chat.initiatorAgentId) {
          return item;
        }

        const initiatorAgent = agentMap.get(item.chat.initiatorAgentId);
        if (!initiatorAgent) {
          return item;
        }

        const initiatorUser = userMap.get(initiatorAgent.userId);
        if (!initiatorUser || !item.contact) {
          return item;
        }

        // Chat INTRA-ORG: Substituir contact pelos dados do INITIATOR
        return {
          ...item,
          contact: {
            id: item.contact.id,
            organizationId: item.contact.organizationId,
            phoneNumber: null,
            name: initiatorUser.name,
            avatar: initiatorUser.image,
            createdAt: item.contact.createdAt,
            updatedAt: item.contact.updatedAt,
            metadata: item.contact.metadata,
          },
        };
      });

      // Mapear items para usar unreadCount do participant ou do chat
      const itemsWithCorrectUnreadCount = resolvedItems.map((item) => ({
        ...item,
        chat: {
          ...item.chat,
          // Usar unreadCount do participant, ou do chat se pending (sem participant)
          unreadCount: item.participant?.unreadCount ?? item.chat.unreadCount,
        },
      }));

      return {
        items: itemsWithCorrectUnreadCount,
        total: totalResult[0]?.count ?? 0,
        limit,
        offset,
      };
    }),

  /**
   * Buscar chat por ID com informações relacionadas
   */
  getById: memberProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        createdAt: z.date(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Chat tem composite PK (id + createdAt)
      const [chatRecord] = await ctx.tenantDb
        .select({
          chat,
          contact,
          assignedAgent: agent,
        })
        .from(chat)
        .leftJoin(contact, eq(chat.contactId, contact.id))
        .leftJoin(agent, eq(chat.assignedTo, agent.id))
        .where(and(eq(chat.id, input.id), eq(chat.createdAt, input.createdAt)))
        .limit(1);

      if (!chatRecord) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Chat não encontrado",
        });
      }

      // Resolver "outro participante" para chats internos
      if (chatRecord.chat.messageSource !== "internal") {
        return chatRecord;
      }

      // Buscar o agent do usuário atual
      const [currentAgent] = await ctx.tenantDb
        .select()
        .from(agent)
        .where(eq(agent.userId, ctx.session.user.id))
        .limit(1);

      if (!currentAgent) {
        return chatRecord;
      }

      // Se usuário atual é o INICIADOR, retornar contact (target)
      if (chatRecord.chat.initiatorAgentId === currentAgent.id) {
        return chatRecord;
      }

      // Se usuário atual é o TARGET, buscar dados do INICIADOR
      if (!chatRecord.chat.initiatorAgentId) {
        return chatRecord;
      }

      const [initiatorAgent] = await ctx.tenantDb
        .select()
        .from(agent)
        .where(eq(agent.id, chatRecord.chat.initiatorAgentId))
        .limit(1);

      if (!initiatorAgent) {
        return chatRecord;
      }

      const [initiatorUser] = await ctx.db
        .select()
        .from(user)
        .where(eq(user.id, initiatorAgent.userId))
        .limit(1);

      if (!initiatorUser || !chatRecord.contact) {
        return chatRecord;
      }

      // Substituir contact pelos dados do INICIADOR
      return {
        ...chatRecord,
        contact: {
          id: chatRecord.contact.id,
          organizationId: chatRecord.contact.organizationId,
          phoneNumber: null,
          name: initiatorUser.name,
          avatar: initiatorUser.image,
          createdAt: chatRecord.contact.createdAt,
          updatedAt: chatRecord.contact.updatedAt,
          metadata: chatRecord.contact.metadata,
        },
      };
    }),

  /**
   * Criar novo chat (interno ou WhatsApp)
   */
  create: ownerProcedure
    .input(
      z.object({
        contactId: z.string().uuid(),
        channelId: z.string().uuid().optional(),
        messageSource: z.enum(["whatsapp", "internal"]),
        assignedTo: z.string().uuid().optional(),
        departmentId: z.string().uuid().optional(),
        initiatorAgentId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.session.session.activeOrganizationId;
      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nenhuma organização ativa",
        });
      }

      const now = new Date();

      // Drizzle gera ID automaticamente
      const [newChat] = await ctx.tenantDb
        .insert(chat)
        .values({
          organizationId,
          contactId: input.contactId,
          channelId: input.channelId,
          messageSource: input.messageSource,
          assignedTo: input.assignedTo,
          departmentId: input.departmentId,
          initiatorAgentId: input.initiatorAgentId,
          status: "open",
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      if (!newChat) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Falha ao criar chat",
        });
      }

      // Atualizar lastMessage com "Nova sessão criada"
      await ctx.tenantDb
        .update(chat)
        .set({
          lastMessageAt: newChat.createdAt,
          lastMessageContent: "Nova sessão criada",
          lastMessageSender: "system",
        })
        .where(and(eq(chat.id, newChat.id), eq(chat.createdAt, newChat.createdAt)));

      // Criar mensagem de sistema "Sessão criada às HH:mm"
      const createdTime = formatTime(newChat.createdAt);

      await ctx.tenantDb.insert(message).values({
        chatId: newChat.id,
        messageSource: newChat.messageSource,
        sender: "system",
        senderId: null,
        messageType: "system",
        content: `Sessão criada às ${createdTime}`,
        status: "sent",
        timestamp: newChat.createdAt,
        metadata: {
          systemEventType: "session_created",
        },
      });

      return newChat;
    }),

  /**
   * Criar nova sessão (chat cross-org) via instance code
   * Cria o chat NO BANCO DA ORG SOURCE (quem está iniciando)
   * O chat só aparece na org TARGET quando a primeira mensagem for enviada
   * Auto-atribui para o agent que criou
   */
  createNewSession: memberProcedure
    .input(
      z.object({
        organizationInstanceCode: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const sourceOrganizationId = ctx.session.session.activeOrganizationId;

      if (!sourceOrganizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nenhuma organização ativa",
        });
      }

      // 1. Buscar TARGET ORGANIZATION no catalog DB
      const [targetOrg] = await ctx.db
        .select()
        .from(organization)
        .where(eq(organization.instanceCode, input.organizationInstanceCode))
        .limit(1);

      if (!targetOrg) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Código da organização não encontrado",
        });
      }

      // 2. Não pode criar chat com a própria organização
      if (targetOrg.id === sourceOrganizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Você não pode criar um chat com sua própria organização",
        });
      }

      const { tenantManager } = await import("../trpc");

      // 3. Conectar ao banco da organização SOURCE (quem está criando)
      const sourceTenantDb = await tenantManager.getConnection(sourceOrganizationId);

      // 4. Criar/buscar contact representando a organização TARGET
      const existingContacts = await sourceTenantDb
        .select()
        .from(contact)
        .where(eq(contact.organizationId, sourceOrganizationId));

      let targetContact = existingContacts.find(
        (c) =>
          c.metadata?.source === "internal" &&
          c.metadata.targetOrganizationId === targetOrg.id,
      );

      if (!targetContact) {
        // Criar novo contato representando a organização target
        const [newContact] = await sourceTenantDb
          .insert(contact)
          .values({
            organizationId: sourceOrganizationId,
            phoneNumber: null,
            name: targetOrg.name,
            avatar: targetOrg.logo ?? undefined,
            metadata: {
              source: "internal",
              targetOrganizationId: targetOrg.id,
              targetOrganizationName: targetOrg.name,
              targetOrganizationInstanceCode: targetOrg.instanceCode,
              firstMessageAt: new Date(),
            },
          })
          .returning();

        if (!newContact) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Falha ao criar contato",
          });
        }

        targetContact = newContact;
      }

      // 5. Verificar se já existe chat open/pending com a mesma organização
      const [existingChat] = await sourceTenantDb
        .select()
        .from(chat)
        .where(
          and(
            eq(chat.messageSource, "internal"),
            eq(chat.contactId, targetContact.id),
            or(eq(chat.status, "open"), eq(chat.status, "pending")),
          ),
        )
        .limit(1);

      if (existingChat) {
        return existingChat;
      }

      // 6. Criar novo chat cross-org NO BANCO DA SOURCE
      const currentAgent = ctx.agent;
      const now = new Date();
      const [newChat] = await sourceTenantDb
        .insert(chat)
        .values({
          organizationId: sourceOrganizationId,
          contactId: targetContact.id,
          channelId: null,
          messageSource: "internal",
          initiatorAgentId: currentAgent.id,
          assignedTo: currentAgent.id, // Auto-atribuir para quem criou
          status: "open",
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      if (!newChat) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Falha ao criar chat",
        });
      }

      // 7. Criar chat_participant para o agent que criou
      await sourceTenantDb.insert(chatParticipant).values({
        chatId: newChat.id,
        chatCreatedAt: newChat.createdAt,
        agentId: currentAgent.id,
        unreadCount: 0,
        lastReadAt: now,
      });

      // 8. Atualizar lastMessage com "Nova sessão criada"
      await sourceTenantDb
        .update(chat)
        .set({
          lastMessageAt: newChat.createdAt,
          lastMessageContent: "Nova sessão criada",
          lastMessageSender: "system",
        })
        .where(and(eq(chat.id, newChat.id), eq(chat.createdAt, newChat.createdAt)));

      // Broadcast Socket.io para TODA a organização SOURCE (não só quem criou)
      await publishChatEvent(
        {
          type: "chat:created",
          organizationId: sourceOrganizationId,
          chatId: newChat.id,
          targetAgentId: undefined, // Broadcast para TODOS os agents
          data: {
            chat: newChat as unknown as Record<string, unknown>,
            contact: targetContact as unknown as Record<string, unknown>,
          },
        },
        env.REDIS_URL,
      );

      // Criar mensagem de sistema "Sessão criada às HH:mm"
      const createdTime = formatTime(newChat.createdAt);

      await sourceTenantDb.insert(message).values({
        chatId: newChat.id,
        messageSource: newChat.messageSource,
        sender: "system",
        senderId: null,
        messageType: "system",
        content: `Sessão criada às ${createdTime}`,
        status: "sent",
        timestamp: newChat.createdAt,
        metadata: {
          systemEventType: "session_created",
          sourceOrganizationId,
          targetOrganizationId: targetOrg.id,
        },
      });

      // Incrementar totalMessages para que o chat apareça para TODOS os agents
      await sourceTenantDb
        .update(chat)
        .set({
          totalMessages: 1,
        })
        .where(and(eq(chat.id, newChat.id), eq(chat.createdAt, newChat.createdAt)));

      return newChat;
    }),

  /**
   * Atualizar chat (status, atribuição, etc)
   * Permissões: Owner, Admin, ou Agent assigned ao chat
   */
  update: memberProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        createdAt: z.date(),
        status: z.enum(["open", "pending", "closed", "snoozed"]).optional(),
        assignedTo: z.string().uuid().nullable().optional(),
        departmentId: z.string().uuid().nullable().optional(),
        priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
        isArchived: z.boolean().optional(),
        isPinned: z.boolean().optional(),
        snoozedUntil: z.date().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, createdAt, ...data } = input;

      // Buscar chat atual para verificar permissões
      const [currentChat] = await ctx.tenantDb
        .select()
        .from(chat)
        .where(and(eq(chat.id, id), eq(chat.createdAt, createdAt)))
        .limit(1);

      if (!currentChat) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Chat não encontrado",
        });
      }

      // Buscar agent do usuário logado
      const [currentAgent] = await ctx.tenantDb
        .select()
        .from(agent)
        .where(eq(agent.userId, ctx.session.user.id))
        .limit(1);

      if (!currentAgent) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Agent não encontrado",
        });
      }

      // Verificar permissões: owner, admin, ou assigned
      const isOwner = currentAgent.role === "owner";
      const isAdmin = currentAgent.role === "admin";
      const isAssigned = currentChat.assignedTo === currentAgent.id;

      if (!isOwner && !isAdmin && !isAssigned) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Apenas o agent responsável pelo atendimento pode atualizar este chat",
        });
      }

      const [updated] = await ctx.tenantDb
        .update(chat)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(and(eq(chat.id, id), eq(chat.createdAt, createdAt)))
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Chat não encontrado",
        });
      }

      return updated;
    }),

  /**
   * Marcar mensagens como lidas (zerar unreadCount)
   * Atualiza chatParticipant para o agent atual
   */
  markAsRead: memberProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        createdAt: z.date(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Buscar o agent atual
      const [currentAgent] = await ctx.tenantDb
        .select()
        .from(agent)
        .where(eq(agent.userId, ctx.session.user.id))
        .limit(1);

      if (!currentAgent) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Agent não encontrado",
        });
      }

      const now = new Date();
      const organizationId = ctx.session.session.activeOrganizationId;

      // Atualizar chatParticipant APENAS para o agent atual
      const [updated] = await ctx.tenantDb
        .update(chatParticipant)
        .set({
          unreadCount: 0,
          lastReadAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(chatParticipant.chatId, input.id),
            eq(chatParticipant.chatCreatedAt, input.createdAt),
            eq(chatParticipant.agentId, currentAgent.id),
          ),
        )
        .returning();

      if (!updated) {
        // Se não existe participant, verificar se é chat pending cross-org
        const [chatRecord] = await ctx.tenantDb
          .select()
          .from(chat)
          .where(and(eq(chat.id, input.id), eq(chat.createdAt, input.createdAt)))
          .limit(1);

        if (!chatRecord) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Chat não encontrado",
          });
        }

        // Se é chat pending (cross-org sem assignment), NÃO zerar unreadCount
        // O badge deve continuar visível até alguém pegar o chat
        if (chatRecord.status === "pending" && !chatRecord.assignedTo) {
          // Retornar o chat sem modificar (apenas visualização)
          return chatRecord;
        }

        // Para outros casos (WhatsApp, etc), zerar unreadCount normalmente
        const [chatUpdated] = await ctx.tenantDb
          .update(chat)
          .set({
            unreadCount: 0,
            updatedAt: now,
          })
          .where(and(eq(chat.id, input.id), eq(chat.createdAt, input.createdAt)))
          .returning();

        return chatUpdated ?? chatRecord;
      }

      // Buscar chat atualizado para retornar
      const [chatRecord] = await ctx.tenantDb
        .select()
        .from(chat)
        .where(and(eq(chat.id, input.id), eq(chat.createdAt, input.createdAt)))
        .limit(1);

      // Broadcast para o agent que marcou como lido
      if (organizationId) {
        await publishChatEvent(
          {
            type: "chat:updated",
            organizationId,
            chatId: input.id,
            targetAgentId: currentAgent.id,
            data: {
              chat: chatRecord as unknown as Record<string, unknown>,
            },
          },
          env.REDIS_URL,
        );
      }

      return chatRecord ?? updated;
    }),

  /**
   * Atribuir chat a um agent (botão "Atender")
   * Permissões: Qualquer agent autenticado pode atribuir
   * IMPORTANTE: NÃO altera department_id, apenas assignedTo e status
   */
  assign: memberProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        createdAt: z.date(),
        agentId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verificar se agent existe
      const [agentExists] = await ctx.tenantDb
        .select()
        .from(agent)
        .where(eq(agent.id, input.agentId))
        .limit(1);

      if (!agentExists) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Agent não encontrado",
        });
      }

      // Atribuir chat ao agent SEM alterar department_id
      // department_id só deve ser alterado na transferência
      const [updated] = await ctx.tenantDb
        .update(chat)
        .set({
          assignedTo: input.agentId,
          status: "open",
          updatedAt: new Date(),
        })
        .where(and(eq(chat.id, input.id), eq(chat.createdAt, input.createdAt)))
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Chat não encontrado",
        });
      }

      // Buscar nome do agent para mensagem de sistema
      const [agentUser] = await ctx.db
        .select()
        .from(user)
        .where(eq(user.id, agentExists.userId))
        .limit(1);

      const agentName = agentUser?.name ?? "Agente";
      const assignTime = formatTime(updated.updatedAt);

      // Criar mensagem de sistema "Sessão transferida para {Nome} às HH:mm"
      await ctx.tenantDb.insert(message).values({
        chatId: updated.id,
        messageSource: updated.messageSource,
        sender: "system",
        senderId: null,
        messageType: "system",
        content: `Sessão transferida para ${agentName} às ${assignTime}`,
        status: "sent",
        timestamp: updated.updatedAt,
        metadata: {
          systemEventType: "session_assigned",
          agentId: agentExists.id,
          agentName,
        },
      });

      // Atualizar lastMessage com "Sessão transferida"
      await ctx.tenantDb
        .update(chat)
        .set({
          lastMessageAt: updated.updatedAt,
          lastMessageContent: "Sessão transferida",
          lastMessageSender: "system",
          unreadCount: 0, // Zerar unreadCount ao atribuir
        })
        .where(and(eq(chat.id, updated.id), eq(chat.createdAt, updated.createdAt)));

      // Criar chatParticipant para o agent (se não existir)
      const existingParticipant = await ctx.tenantDb
        .select()
        .from(chatParticipant)
        .where(
          and(
            eq(chatParticipant.chatId, updated.id),
            eq(chatParticipant.chatCreatedAt, updated.createdAt),
            eq(chatParticipant.agentId, input.agentId),
          ),
        )
        .limit(1);

      if (existingParticipant.length === 0) {
        await ctx.tenantDb.insert(chatParticipant).values({
          chatId: updated.id,
          chatCreatedAt: updated.createdAt,
          agentId: input.agentId,
          unreadCount: 0,
          lastReadAt: updated.updatedAt,
        });
      } else {
        // Se já existe, apenas zerar unreadCount
        await ctx.tenantDb
          .update(chatParticipant)
          .set({
            unreadCount: 0,
            lastReadAt: updated.updatedAt,
            updatedAt: updated.updatedAt,
          })
          .where(
            and(
              eq(chatParticipant.chatId, updated.id),
              eq(chatParticipant.chatCreatedAt, updated.createdAt),
              eq(chatParticipant.agentId, input.agentId),
            ),
          );
      }

      // Publicar evento de atualização para todos da organização
      const organizationId = ctx.session.session.activeOrganizationId;
      if (organizationId) {
        await publishChatEvent(
          {
            type: "chat:updated",
            organizationId,
            chatId: updated.id,
            data: {
              chat: updated as unknown as Record<string, unknown>,
            },
          },
          env.REDIS_URL,
        );
      }

      return updated;
    }),

  /**
   * Transferir chat para outro agent ou departamento
   * Permissões: Owner, Admin, ou Agent assigned ao chat
   * Se transferir para agent: atribui ao agent e seta departmentId baseado nas permissões
   * Se transferir para departamento: seta departmentId e remove assignedTo
   */
  transfer: memberProcedure
    .input(
      z
        .object({
          id: z.string().uuid(),
          createdAt: z.date(),
          targetAgentId: z.string().uuid().optional(),
          targetDepartmentId: z.string().uuid().optional(),
        })
        .refine((data) => data.targetAgentId ?? data.targetDepartmentId, {
          message: "Deve especificar targetAgentId ou targetDepartmentId",
        }),
    )
    .mutation(async ({ ctx, input }) => {
      // Buscar chat atual para verificar permissões
      const [currentChat] = await ctx.tenantDb
        .select()
        .from(chat)
        .where(and(eq(chat.id, input.id), eq(chat.createdAt, input.createdAt)))
        .limit(1);

      if (!currentChat) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Chat não encontrado",
        });
      }

      // Buscar agent do usuário logado
      const [currentAgent] = await ctx.tenantDb
        .select()
        .from(agent)
        .where(eq(agent.userId, ctx.session.user.id))
        .limit(1);

      if (!currentAgent) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Agent não encontrado",
        });
      }

      // Verificar permissões: owner, admin, ou assigned
      const isOwner = currentAgent.role === "owner";
      const isAdmin = currentAgent.role === "admin";
      const isAssigned = currentChat.assignedTo === currentAgent.id;

      if (!isOwner && !isAdmin && !isAssigned) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Apenas o agent responsável pelo atendimento pode transferir este chat",
        });
      }

      // Caso 1: Transferir para um agent específico
      if (input.targetAgentId) {
        // Verificar se agent existe
        const [agentExists] = await ctx.tenantDb
          .select()
          .from(agent)
          .where(eq(agent.id, input.targetAgentId))
          .limit(1);

        if (!agentExists) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Agent não encontrado",
          });
        }

        // Determinar departmentId baseado nas permissões do agent
        let chatDepartmentId: string | null = null;
        if (
          agentExists.permissions.departments.type === "specific" &&
          agentExists.permissions.departments.ids &&
          agentExists.permissions.departments.ids.length > 0
        ) {
          chatDepartmentId = agentExists.permissions.departments.ids[0] ?? null;
        }

        const [updated] = await ctx.tenantDb
          .update(chat)
          .set({
            assignedTo: input.targetAgentId,
            departmentId: chatDepartmentId,
            status: "open",
            updatedAt: new Date(),
          })
          .where(
            and(eq(chat.id, input.id), eq(chat.createdAt, input.createdAt)),
          )
          .returning();

        if (!updated) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Chat não encontrado",
          });
        }

        // Buscar nomes dos agents para mensagem de sistema
        const [fromUser] = await ctx.db
          .select()
          .from(user)
          .where(eq(user.id, currentAgent.userId))
          .limit(1);

        const [toUser] = await ctx.db
          .select()
          .from(user)
          .where(eq(user.id, agentExists.userId))
          .limit(1);

        const fromName = fromUser?.name ?? "Agente";
        const toName = toUser?.name ?? "Agente";
        const transferTime = formatTime(updated.updatedAt);

        // Criar mensagem de sistema "Sessão transferida de X para Y às HH:mm"
        await ctx.tenantDb.insert(message).values({
          chatId: updated.id,
          messageSource: updated.messageSource,
          sender: "system",
          senderId: null,
          messageType: "system",
          content: `Sessão transferida de ${fromName} para ${toName} às ${transferTime}`,
          status: "sent",
          timestamp: updated.updatedAt,
          metadata: {
            systemEventType: "session_transferred",
            fromAgentId: currentAgent.id,
            fromAgentName: fromName,
            toAgentId: agentExists.id,
            toAgentName: toName,
          },
        });

        // Atualizar lastMessage com "Sessão transferida"
        await ctx.tenantDb
          .update(chat)
          .set({
            lastMessageAt: updated.updatedAt,
            lastMessageContent: "Sessão transferida",
            lastMessageSender: "system",
          })
          .where(and(eq(chat.id, updated.id), eq(chat.createdAt, updated.createdAt)));

        // Publicar evento de atualização para todos da organização
        const organizationId = ctx.session.session.activeOrganizationId;
        if (organizationId) {
          await publishChatEvent(
            {
              type: "chat:updated",
              organizationId,
              chatId: updated.id,
              data: {
                chat: updated as unknown as Record<string, unknown>,
              },
            },
            env.REDIS_URL,
          );
        }

        return updated;
      }

      // Caso 2: Transferir para um departamento (sem agent específico)
      if (input.targetDepartmentId) {
        const [updated] = await ctx.tenantDb
          .update(chat)
          .set({
            assignedTo: null,
            departmentId: input.targetDepartmentId,
            status: "pending",
            updatedAt: new Date(),
          })
          .where(
            and(eq(chat.id, input.id), eq(chat.createdAt, input.createdAt)),
          )
          .returning();

        if (!updated) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Chat não encontrado",
          });
        }

        // Atualizar lastMessage com "Sessão transferida"
        await ctx.tenantDb
          .update(chat)
          .set({
            lastMessageAt: updated.updatedAt,
            lastMessageContent: "Sessão transferida",
            lastMessageSender: "system",
          })
          .where(and(eq(chat.id, updated.id), eq(chat.createdAt, updated.createdAt)));

        // Publicar evento de atualização para todos da organização
        const organizationId = ctx.session.session.activeOrganizationId;
        if (organizationId) {
          await publishChatEvent(
            {
              type: "chat:updated",
              organizationId,
              chatId: updated.id,
              data: {
                chat: updated as unknown as Record<string, unknown>,
              },
            },
            env.REDIS_URL,
          );
        }

        return updated;
      }

      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Deve especificar targetAgentId ou targetDepartmentId",
      });
    }),

  /**
   * Fechar chat e gerar mensagem de sistema com protocolo
   * Permissões: Owner, Admin, ou Agent assigned ao chat
   */
  close: memberProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        createdAt: z.date(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Buscar chat atual
      const [currentChat] = await ctx.tenantDb
        .select()
        .from(chat)
        .where(and(eq(chat.id, input.id), eq(chat.createdAt, input.createdAt)))
        .limit(1);

      if (!currentChat) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Chat não encontrado",
        });
      }

      // 2. Buscar agent do usuário logado
      const [currentAgent] = await ctx.tenantDb
        .select()
        .from(agent)
        .where(eq(agent.userId, ctx.session.user.id))
        .limit(1);

      if (!currentAgent) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Agent não encontrado",
        });
      }

      // 3. Verificar permissões: owner, admin, ou assigned
      const isOwner = currentAgent.role === "owner";
      const isAdmin = currentAgent.role === "admin";
      const isAssigned = currentChat.assignedTo === currentAgent.id;

      if (!isOwner && !isAdmin && !isAssigned) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Apenas o agent responsável pelo atendimento pode finalizar este chat",
        });
      }

      // 4. Buscar informações do agent para a mensagem de sistema
      const [agentUser] = await ctx.db
        .select()
        .from(user)
        .where(eq(user.id, currentAgent.userId))
        .limit(1);

      const agentName = agentUser?.name ?? "Agente";

      // 5. Buscar departamento (se houver)
      let departmentName = "";
      if (currentChat.departmentId) {
        const [deptData] = await ctx.tenantDb
          .select()
          .from(department)
          .where(eq(department.id, currentChat.departmentId))
          .limit(1);

        departmentName = deptData?.name ?? "";
      }

      // 6. Buscar primeira mensagem enviada (não de sistema) para pegar "Atendido em"
      const [firstMessage] = await ctx.tenantDb
        .select()
        .from(message)
        .where(
          and(
            eq(message.chatId, input.id),
            sql`${message.sender} != 'system'`, // Ignorar mensagens de sistema
          ),
        )
        .orderBy(asc(message.timestamp))
        .limit(1);

      // 7. Fechar o chat
      const closedAt = new Date();
      const [updated] = await ctx.tenantDb
        .update(chat)
        .set({
          status: "closed",
          updatedAt: closedAt,
        })
        .where(and(eq(chat.id, input.id), eq(chat.createdAt, input.createdAt)))
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Chat não encontrado",
        });
      }

      // 8. Calcular duração (entre primeira mensagem e finalizado)
      const attendedAt = firstMessage?.timestamp ?? currentChat.createdAt;
      const duration = calculateDuration(new Date(attendedAt), closedAt);

      // 9. Gerar mensagem de sistema formatada
      const systemMessageContent = `Protocolo: ${currentChat.id}
Usuário: ${agentName}
Departamento: ${departmentName}
Iniciado em: ${formatDateTime(currentChat.createdAt)}
Atendido em: ${formatDateTime(new Date(attendedAt))}
Finalizado em: ${formatDateTime(closedAt)}
Duração: ${duration}`;

      await ctx.tenantDb.insert(message).values({
        chatId: updated.id,
        messageSource: updated.messageSource,
        sender: "system",
        senderId: null,
        messageType: "system",
        content: systemMessageContent,
        status: "sent",
        timestamp: closedAt,
        metadata: {
          systemEventType: "session_closed",
          agentId: currentAgent.id,
          agentName,
          protocol: currentChat.id,
          departmentName,
          startedAt: currentChat.createdAt.toISOString(),
          attendedAt: new Date(attendedAt).toISOString(),
          closedAt: closedAt.toISOString(),
          duration,
        },
      });

      // 10. Publicar evento de atualização para todos da organização
      const organizationId = ctx.session.session.activeOrganizationId;
      if (organizationId) {
        await publishChatEvent(
          {
            type: "chat:updated",
            organizationId,
            chatId: updated.id,
            data: {
              chat: updated as unknown as Record<string, unknown>,
            },
          },
          env.REDIS_URL,
        );
      }

      return updated;
    }),

  /**
   * Reabrir chat
   */
  reopen: ownerProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        createdAt: z.date(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.tenantDb
        .update(chat)
        .set({
          status: "open",
          updatedAt: new Date(),
        })
        .where(and(eq(chat.id, input.id), eq(chat.createdAt, input.createdAt)))
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Chat não encontrado",
        });
      }

      // Criar mensagem de sistema
      await ctx.tenantDb.insert(message).values({
        chatId: updated.id,
        messageSource: updated.messageSource,
        sender: "system",
        senderId: null,
        messageType: "system",
        content: "Nova sessão criada",
        status: "sent",
        timestamp: new Date(),
        metadata: {
          systemEventType: "session_reopened",
          agentName: ctx.session.user.name,
          agentId: ctx.session.user.id,
          reopenedAt: new Date().toISOString(),
        },
      });

      // Atualizar lastMessage com "Nova sessão criada"
      await ctx.tenantDb
        .update(chat)
        .set({
          lastMessageAt: updated.updatedAt,
          lastMessageContent: "Nova sessão criada",
          lastMessageSender: "system",
        })
        .where(and(eq(chat.id, updated.id), eq(chat.createdAt, updated.createdAt)));

      // Publicar evento de atualização para todos da organização
      const organizationId = ctx.session.session.activeOrganizationId;
      if (organizationId) {
        await publishChatEvent(
          {
            type: "chat:updated",
            organizationId,
            chatId: updated.id,
            data: {
              chat: updated as unknown as Record<string, unknown>,
            },
          },
          env.REDIS_URL,
        );
      }

      return updated;
    }),

  /**
   * Estatísticas dos chats
   */
  stats: ownerProcedure.query(async ({ ctx }) => {
    const [stats] = await ctx.tenantDb
      .select({
        total: count(),
        open: sql<number>`count(*) FILTER (WHERE ${chat.status} = 'open')`,
        pending: sql<number>`count(*) FILTER (WHERE ${chat.status} = 'pending')`,
        closed: sql<number>`count(*) FILTER (WHERE ${chat.status} = 'closed')`,
        unassigned: sql<number>`count(*) FILTER (WHERE ${chat.assignedTo} IS NULL)`,
      })
      .from(chat);

    return stats;
  }),
});
