import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  agent,
  and,
  chat,
  contact,
  count,
  desc,
  eq,
  inArray,
  isNull,
  or,
  sql,
  user,
} from "@manylead/db";
import { publishChatEvent } from "@manylead/shared";

import { env } from "../env";
import {
  createTRPCRouter,
  memberProcedure,
  ownerProcedure,
  protectedProcedure,
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
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { status, assignedTo, departmentId, messageSource, limit, offset } =
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
      // 1. Chat com mensagens (totalMessages > 0): aparece para todos os participantes
      // 2. Chat sem mensagens: só aparece para quem CRIOU (initiatorAgentId = current agent)
      if (currentAgent) {
        conditions.push(
          sql`(${chat.totalMessages} > 0 OR ${chat.initiatorAgentId} = ${currentAgent.id})`,
        );
      } else {
        conditions.push(sql`${chat.totalMessages} > 0`);
      }

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

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      // Executar queries em paralelo
      const [items, totalResult] = await Promise.all([
        ctx.tenantDb
          .select({
            chat,
            contact,
            assignedAgent: agent,
          })
          .from(chat)
          .leftJoin(contact, eq(chat.contactId, contact.id))
          .leftJoin(agent, eq(chat.assignedTo, agent.id))
          .where(where)
          .limit(limit)
          .offset(offset)
          .orderBy(desc(chat.lastMessageAt)),
        ctx.tenantDb.select({ count: count() }).from(chat).where(where),
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

      // Se não tem nenhum para resolver, retorna direto
      if (initiatorAgentIds.length === 0) {
        return { items, total: totalResult[0]?.count ?? 0, limit, offset };
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

        // Substituir contact pelos dados do INITIATOR
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

      return {
        items: resolvedItems,
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

      return newChat;
    }),

  /**
   * Criar chat interno via instance code
   * Fluxo completo: buscar agent -> criar/buscar contact -> detectar duplicata -> criar chat
   */
  createInternalChat: protectedProcedure
    .input(
      z.object({
        targetInstanceCode: z.string(),
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

      const { tenantManager } = await import("../trpc");
      const tenantDb = await tenantManager.getConnection(organizationId);

      // 1. Buscar target agent por instanceCode
      const [targetAgent] = await tenantDb
        .select()
        .from(agent)
        .where(eq(agent.instanceCode, input.targetInstanceCode))
        .limit(1);

      if (!targetAgent) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Instance code não encontrado",
        });
      }

      // Não pode criar chat consigo mesmo
      if (targetAgent.userId === ctx.session.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Você não pode criar um chat consigo mesmo",
        });
      }

      // 2. Buscar user do target agent para pegar nome e avatar
      const [targetUser] = await ctx.db
        .select()
        .from(user)
        .where(eq(user.id, targetAgent.userId))
        .limit(1);

      if (!targetUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Usuário não encontrado",
        });
      }

      // 3. Criar/buscar contact interno para o target agent
      const existingContacts = await tenantDb
        .select()
        .from(contact)
        .where(eq(contact.organizationId, organizationId));

      let targetContact = existingContacts.find(
        (c) => c.metadata?.agentId === targetAgent.id,
      );

      if (!targetContact) {
        // Criar novo contato interno
        const [newContact] = await tenantDb
          .insert(contact)
          .values({
            organizationId,
            phoneNumber: null,
            name: targetUser.name,
            avatar: targetUser.image ?? undefined,
            metadata: {
              source: "internal" as const,
              agentId: targetAgent.id,
              firstMessageAt: new Date(),
            },
          })
          .returning();

        if (!newContact) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Falha ao criar contato interno",
          });
        }

        targetContact = newContact;
      }

      // 4. Buscar o agent atual (criador do chat)
      const [currentAgent] = await tenantDb
        .select()
        .from(agent)
        .where(eq(agent.userId, ctx.session.user.id))
        .limit(1);

      if (!currentAgent) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Agent atual não encontrado",
        });
      }

      // 5. Detectar chat duplicado (verificar se já existe chat interno entre os 2 agents)
      const existingChat = await tenantDb
        .select({
          chat,
          contact,
        })
        .from(chat)
        .leftJoin(contact, eq(chat.contactId, contact.id))
        .where(
          and(
            eq(chat.messageSource, "internal"),
            eq(chat.contactId, targetContact.id),
          ),
        )
        .limit(1);

      if (existingChat.length > 0 && existingChat[0]?.chat) {
        // Chat já existe, retornar ele
        return existingChat[0].chat;
      }

      // 6. Criar novo chat interno
      const now = new Date();
      const [newChat] = await tenantDb
        .insert(chat)
        .values({
          organizationId,
          contactId: targetContact.id,
          channelId: null, // Chats internos não têm canal
          messageSource: "internal",
          initiatorAgentId: currentAgent.id,
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

      // Emitir eventos Socket.io PERSONALIZADOS para cada participante

      // Buscar dados do initiator para enviar pro target
      const [currentUser] = await ctx.db
        .select()
        .from(user)
        .where(eq(user.id, currentAgent.userId))
        .limit(1);

      if (!currentUser) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Usuário atual não encontrado",
        });
      }

      // Evento para o INICIADOR - mostrar target contact
      await publishChatEvent(
        {
          type: "chat:created",
          organizationId,
          chatId: newChat.id,
          targetAgentId: currentAgent.id,
          data: {
            chat: newChat as unknown as Record<string, unknown>,
            contact: targetContact as unknown as Record<string, unknown>,
          },
        },
        env.REDIS_URL,
      );

      // Evento para o TARGET - mostrar initiator data
      await publishChatEvent(
        {
          type: "chat:created",
          organizationId,
          chatId: newChat.id,
          targetAgentId: targetAgent.id,
          data: {
            chat: newChat as unknown as Record<string, unknown>,
            contact: {
              id: targetContact.id,
              organizationId: targetContact.organizationId,
              phoneNumber: null,
              name: currentUser.name,
              avatar: currentUser.image,
              createdAt: targetContact.createdAt,
              updatedAt: targetContact.updatedAt,
              metadata: targetContact.metadata,
            } as unknown as Record<string, unknown>,
          },
        },
        env.REDIS_URL,
      );

      return newChat;
    }),

  /**
   * Atualizar chat (status, atribuição, etc)
   */
  update: ownerProcedure
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
   */
  markAsRead: ownerProcedure
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
          unreadCount: 0,
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

      return updated;
    }),

  /**
   * Atribuir chat a um agent
   */
  assign: ownerProcedure
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

      // Determinar departmentId do chat baseado nas permissões do agent
      // Se agent tem permissões específicas de departamento, usa o primeiro da lista
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
          assignedTo: input.agentId,
          departmentId: chatDepartmentId,
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

      return updated;
    }),

  /**
   * Transferir chat para outro agent ou departamento
   * Se transferir para agent: atribui ao agent e seta departmentId baseado nas permissões
   * Se transferir para departamento: seta departmentId e remove assignedTo
   */
  transfer: ownerProcedure
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

        return updated;
      }

      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Deve especificar targetAgentId ou targetDepartmentId",
      });
    }),

  /**
   * Fechar chat
   */
  close: ownerProcedure
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
          status: "closed",
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
