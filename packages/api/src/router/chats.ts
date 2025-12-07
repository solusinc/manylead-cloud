import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  agent,
  and,
  channel,
  chat,
  chatParticipant,
  contact,
  count,
  desc,
  eq,
  inArray,
  message,
  ne,
  or,
  organization,
  sql,
  user,
} from "@manylead/db";
import { publishChatEvent, formatTime, normalizePhoneNumber } from "@manylead/shared";
import { EvolutionAPIClient } from "@manylead/evolution-api-client";

import { env } from "../env";
import {
  createTRPCRouter,
  memberProcedure,
  ownerProcedure,
  tenantManager,
} from "../trpc";
import { getDefaultDepartment } from "@manylead/core-services";
import {
  ChatPermissionsService,
  ChatParticipantService,
  getChatService,
  ChatCrossOrgService,
  getChatQueryBuilderService,
} from "@manylead/core-services/chat";
import type { ChatContext } from "@manylead/core-services/chat";

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
        agentIds: z.array(z.string().uuid()).optional(),
        departmentId: z.string().uuid().optional(),
        departmentIds: z.array(z.string().uuid()).optional(),
        messageSource: z.enum(["whatsapp", "internal"]).optional(),
        messageSources: z.array(z.enum(["whatsapp", "internal"])).optional(),
        dateFrom: z.date().optional(),
        dateTo: z.date().optional(),
        search: z.string().optional(),
        unreadOnly: z.boolean().optional(),
        tagIds: z.array(z.string().uuid()).optional(),
        endingIds: z.array(z.string().uuid()).optional(),
        isArchived: z.boolean().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Buscar currentAgent
      const permissionsService = new ChatPermissionsService(ctx.tenantDb);
      const currentAgent = await permissionsService.getCurrentAgent(ctx.session.user.id);

      // Usar ChatQueryBuilderService para executar query com todos os filtros
      const queryBuilderService = getChatQueryBuilderService({
        redisUrl: env.REDIS_URL,
        getTenantConnection: tenantManager.getConnection.bind(tenantManager),
        getCatalogDb: () => ctx.db,
      });

      const result = await queryBuilderService.list(ctx.tenantDb, currentAgent, input);

      return {
        items: result.items,
        total: result.total,
        limit: input.limit,
        offset: input.offset,
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

      // Buscar currentAgent para cross-org resolution
      const permissionsService = new ChatPermissionsService(ctx.tenantDb);
      const currentAgent = await permissionsService.getCurrentAgent(ctx.session.user.id);

      // Usar ChatCrossOrgService para resolver "outro participante" em chats internos
      const crossOrgService = new ChatCrossOrgService(ctx.tenantDb, ctx.db);
      const resolvedContact = await crossOrgService.resolveInternalChatParticipant(
        chatRecord.chat,
        chatRecord.contact,
        currentAgent.id,
      );

      return {
        ...chatRecord,
        contact: resolvedContact,
      };
    }),

  /**
   * Buscar histórico de atendimentos do mesmo contato
   */
  history: memberProcedure
    .input(
      z.object({
        contactId: z.string().uuid(),
        currentChatId: z.string().uuid(), // Para identificar o chat atual
      }),
    )
    .query(async ({ ctx, input }) => {
      // Buscar todos os chats do mesmo contato, ordenados por data (mais recente primeiro)
      const chats = await ctx.tenantDb
        .select({
          chat,
          assignedAgent: agent,
        })
        .from(chat)
        .leftJoin(agent, eq(chat.assignedTo, agent.id))
        .where(eq(chat.contactId, input.contactId))
        .orderBy(desc(chat.createdAt));

      // Buscar nomes dos usuários (user está no banco principal)
      const agentUserIds = chats
        .map((c) => c.assignedAgent?.userId)
        .filter((id): id is string => !!id);

      const users = agentUserIds.length > 0
        ? await ctx.db
            .select({ id: user.id, name: user.name })
            .from(user)
            .where(inArray(user.id, agentUserIds))
        : [];

      const userMap = new Map(users.map((u) => [u.id, u.name]));

      return {
        items: chats.map((item) => ({
          id: item.chat.id,
          createdAt: item.chat.createdAt,
          status: item.chat.status,
          // Usar updatedAt como proxy para closedAt quando status é closed
          closedAt: item.chat.status === "closed" ? item.chat.updatedAt : null,
          assignedAgentName: item.assignedAgent?.userId
            ? userMap.get(item.assignedAgent.userId) ?? null
            : null,
          isCurrent: item.chat.id === input.currentChatId,
        })),
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

      // Se departmentId não foi fornecido, usar o padrão
      const finalDepartmentId =
        input.departmentId ??
        (await getDefaultDepartment(ctx.tenantDb, organizationId));

      // Drizzle gera ID automaticamente
      const [newChat] = await ctx.tenantDb
        .insert(chat)
        .values({
          organizationId,
          contactId: input.contactId,
          channelId: input.channelId,
          messageSource: input.messageSource,
          assignedTo: input.assignedTo,
          departmentId: finalDepartmentId,
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
          lastMessageStatus: "sent",
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

      // Buscar departamento padrão da org de origem
      const sourceDepartmentId = await getDefaultDepartment(
        sourceTenantDb,
        sourceOrganizationId,
      );

      const [newChat] = await sourceTenantDb
        .insert(chat)
        .values({
          organizationId: sourceOrganizationId,
          contactId: targetContact.id,
          channelId: null,
          messageSource: "internal",
          initiatorAgentId: currentAgent.id,
          assignedTo: currentAgent.id, // Auto-atribuir para quem criou
          departmentId: sourceDepartmentId,
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
          lastMessageStatus: "sent",
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
   * Criar novo chat WhatsApp através do modal "Iniciar conversa"
   * Valida se número está no WhatsApp via Evolution API
   * Auto-atribui ao criador e seta status como "open"
   */
  createWhatsAppChat: memberProcedure
    .input(
      z.object({
        phoneNumber: z.string().min(10, "Número muito curto"),
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

      // 1. Normalizar número (remover formatação)
      const normalizedPhone = normalizePhoneNumber(input.phoneNumber);

      // 2. Buscar primeiro canal conectado (status: 'connected' AND isActive: true)
      const [firstConnectedChannel] = await ctx.tenantDb
        .select()
        .from(channel)
        .where(
          and(
            eq(channel.organizationId, sourceOrganizationId),
            eq(channel.status, "connected"),
            eq(channel.isActive, true),
          ),
        )
        .limit(1);

      if (!firstConnectedChannel) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Nenhum canal WhatsApp conectado. Configure um canal nas configurações.",
        });
      }

      // 3. Validar se número está no WhatsApp via Evolution API
      const evolutionClient = new EvolutionAPIClient(
        env.EVOLUTION_API_URL,
        env.EVOLUTION_API_KEY,
      );

      const checkResult = await evolutionClient.chat.checkWhatsappNumbers(
        firstConnectedChannel.evolutionInstanceName,
        [normalizedPhone],
      );

      if (!checkResult[0]?.exists) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Este número não está cadastrado no WhatsApp",
        });
      }

      // 4. Buscar/criar Contact
      const [existingContact] = await ctx.tenantDb
        .select()
        .from(contact)
        .where(
          and(
            eq(contact.organizationId, sourceOrganizationId),
            eq(contact.phoneNumber, normalizedPhone),
          ),
        )
        .limit(1);

      let targetContact = existingContact;

      if (!targetContact) {
        // Buscar foto de perfil antes de criar contato
        let profilePictureUrl: string | null = null;
        try {
          const profileResult = await evolutionClient.instance.fetchProfilePicture(
            firstConnectedChannel.evolutionInstanceName,
            normalizedPhone,
          );
          profilePictureUrl = profileResult.profilePictureUrl;
        } catch (error) {
          // Ignorar erro (foto pode estar privada)
          profilePictureUrl = null;
        }

        // Criar novo contato
        const [newContact] = await ctx.tenantDb
          .insert(contact)
          .values({
            organizationId: sourceOrganizationId,
            phoneNumber: normalizedPhone,
            name: normalizedPhone, // Usar número como nome inicialmente
            avatar: profilePictureUrl,
            metadata: {
              source: "whatsapp",
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
      } else if (!targetContact.avatar) {
        // Contato já existe mas não tem foto - buscar e atualizar
        try {
          const profileResult = await evolutionClient.instance.fetchProfilePicture(
            firstConnectedChannel.evolutionInstanceName,
            normalizedPhone,
          );

          if (profileResult.profilePictureUrl) {
            await ctx.tenantDb
              .update(contact)
              .set({
                avatar: profileResult.profilePictureUrl,
                updatedAt: new Date(),
              })
              .where(eq(contact.id, targetContact.id));

            targetContact = {
              ...targetContact,
              avatar: profileResult.profilePictureUrl,
            };
          }
        } catch (error) {
          // Ignorar erro (foto pode estar privada)
        }
      }

      // 5. Verificar se já existe chat open/pending com este contato e canal
      const [existingChat] = await ctx.tenantDb
        .select()
        .from(chat)
        .where(
          and(
            eq(chat.messageSource, "whatsapp"),
            eq(chat.contactId, targetContact.id),
            eq(chat.channelId, firstConnectedChannel.id),
            or(eq(chat.status, "open"), eq(chat.status, "pending")),
          ),
        )
        .limit(1);

      if (existingChat) {
        // Retornar chat existente
        return existingChat;
      }

      // 6. Criar novo Chat
      const permissionsService = new ChatPermissionsService(ctx.tenantDb);
      const currentAgent = await permissionsService.getCurrentAgent(ctx.session.user.id);
      const now = new Date();

      // Buscar departamento padrão
      const departmentId = await getDefaultDepartment(
        ctx.tenantDb,
        sourceOrganizationId,
      );

      const [newChat] = await ctx.tenantDb
        .insert(chat)
        .values({
          organizationId: sourceOrganizationId,
          contactId: targetContact.id,
          channelId: firstConnectedChannel.id,
          messageSource: "whatsapp",
          assignedTo: currentAgent.id, // Auto-atribuir ao criador
          departmentId,
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

      // 7. Criar mensagem de sistema "Sessão criada às HH:mm"
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

      // 8. Atualizar lastMessage com "Sessão criada às HH:mm"
      await ctx.tenantDb
        .update(chat)
        .set({
          lastMessageAt: newChat.createdAt,
          lastMessageContent: `Sessão criada às ${createdTime}`,
          lastMessageSender: "system",
          lastMessageStatus: "sent",
          totalMessages: 1,
        })
        .where(and(eq(chat.id, newChat.id), eq(chat.createdAt, newChat.createdAt)));

      // 9. Criar chatParticipant para o criador
      await ctx.tenantDb.insert(chatParticipant).values({
        chatId: newChat.id,
        chatCreatedAt: newChat.createdAt,
        agentId: currentAgent.id,
        unreadCount: 0,
        lastReadAt: now,
      });

      // 10. Emitir evento Socket.IO broadcast para toda a organização
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

      // Usar ChatPermissionsService para buscar currentAgent
      const permissionsService = new ChatPermissionsService(ctx.tenantDb);
      const currentAgent = await permissionsService.getCurrentAgent(ctx.session.user.id);

      // Validar organizationId
      const organizationId = ctx.session.session.activeOrganizationId;
      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nenhuma organização ativa",
        });
      }

      // Buscar chat atual para verificar permissões
      const chatService = getChatService({
        redisUrl: env.REDIS_URL,
        getTenantConnection: tenantManager.getConnection.bind(tenantManager),
        getCatalogDb: () => ctx.db,
      });

      const chatContext: ChatContext = {
        organizationId,
        tenantDb: ctx.tenantDb,
        agentId: currentAgent.id,
        userId: ctx.session.user.id,
      };

      const currentChat = await chatService.getById(chatContext, id, createdAt);

      // Verificar permissões usando ChatPermissionsService
      permissionsService.requireModifyPermission(currentAgent, currentChat);

      // Atualizar chat usando ChatService
      const updated = await chatService.update(chatContext, id, createdAt, data);

      return updated;
    }),

  /**
   * Toggle pin status (with max 3 pins validation)
   */
  togglePin: memberProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        createdAt: z.date(),
        isPinned: z.boolean(),
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

      // If trying to pin, check max 3 limit
      if (input.isPinned) {
        const [result] = await ctx.tenantDb
          .select({ count: count() })
          .from(chat)
          .where(
            and(
              eq(chat.organizationId, organizationId),
              eq(chat.isPinned, true),
              // Exclude current chat from count
              or(
                ne(chat.id, input.id),
                ne(chat.createdAt, input.createdAt)
              )
            )
          );

        const pinnedCount = result?.count ?? 0;
        if (pinnedCount >= 3) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Você só pode fixar até 3 conversas",
          });
        }
      }

      // Use existing update flow
      const permissionsService = new ChatPermissionsService(ctx.tenantDb);
      const currentAgent = await permissionsService.getCurrentAgent(ctx.session.user.id);

      const chatContext: ChatContext = {
        organizationId,
        tenantDb: ctx.tenantDb,
        agentId: currentAgent.id,
        userId: ctx.session.user.id,
      };

      const chatService = getChatService({
        redisUrl: env.REDIS_URL,
        getTenantConnection: tenantManager.getConnection.bind(tenantManager),
        getCatalogDb: () => ctx.db,
      });

      const currentChat = await chatService.getById(chatContext, input.id, input.createdAt);

      // Verify permissions
      permissionsService.requireModifyPermission(currentAgent, currentChat);

      return await chatService.update(
        chatContext,
        input.id,
        input.createdAt,
        {
          isPinned: input.isPinned,
          pinnedAt: input.isPinned ? new Date() : null,
        }
      );
    }),

  /**
   * Toggle archive status (unpins when archiving)
   */
  toggleArchive: memberProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        createdAt: z.date(),
        isArchived: z.boolean(),
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

      const permissionsService = new ChatPermissionsService(ctx.tenantDb);
      const currentAgent = await permissionsService.getCurrentAgent(ctx.session.user.id);

      const chatContext: ChatContext = {
        organizationId,
        tenantDb: ctx.tenantDb,
        agentId: currentAgent.id,
        userId: ctx.session.user.id,
      };

      const chatService = getChatService({
        redisUrl: env.REDIS_URL,
        getTenantConnection: tenantManager.getConnection.bind(tenantManager),
        getCatalogDb: () => ctx.db,
      });

      const currentChat = await chatService.getById(chatContext, input.id, input.createdAt);

      // Verify permissions
      permissionsService.requireModifyPermission(currentAgent, currentChat);

      // When archiving, unpin automatically
      const updateData: { isArchived: boolean; isPinned?: boolean; pinnedAt?: Date | null } = {
        isArchived: input.isArchived,
      };
      if (input.isArchived) {
        updateData.isPinned = false;
        updateData.pinnedAt = null;
      }

      return await chatService.update(
        chatContext,
        input.id,
        input.createdAt,
        updateData
      );
    }),

  /**
   * Get count of archived chats
   */
  getArchivedCount: memberProcedure
    .query(async ({ ctx }) => {
      const organizationId = ctx.session.session.activeOrganizationId;
      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nenhuma organização ativa",
        });
      }

      const [result] = await ctx.tenantDb
        .select({ count: count() })
        .from(chat)
        .where(
          and(
            eq(chat.organizationId, organizationId),
            eq(chat.isArchived, true)
          )
        );

      return result?.count ?? 0;
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
      // Usar ChatPermissionsService para buscar currentAgent
      const permissionsService = new ChatPermissionsService(ctx.tenantDb);
      const currentAgent = await permissionsService.getCurrentAgent(ctx.session.user.id);

      const now = new Date();
      const organizationId = ctx.session.session.activeOrganizationId;

      // Usar ChatParticipantService para marcar como lido
      const participantService = new ChatParticipantService(ctx.tenantDb);
      const updated = await participantService.markAsRead(input.id, input.createdAt, currentAgent.id);

      if (!updated) {
        // Se não existe participant, é chat pending/unassigned
        // NUNCA zerar badge de chats pending (badge fica até ser assigned)
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

        // Retornar sem modificar (pending nunca zera)
        return chatRecord;
      }

      // Chat ASSIGNED: zerar unreadCount de TODOS os participants da org
      // Para que quando qualquer um clicar, todos vejam como lido
      await ctx.tenantDb
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
          ),
        );

      // Buscar chat atualizado para retornar
      const [chatRecord] = await ctx.tenantDb
        .select()
        .from(chat)
        .where(and(eq(chat.id, input.id), eq(chat.createdAt, input.createdAt)))
        .limit(1);

      // Broadcast para TODOS (sem targetAgentId)
      // Para que todos vejam o badge desaparecer em tempo real
      if (organizationId) {
        await publishChatEvent(
          {
            type: "chat:updated",
            organizationId,
            chatId: input.id,
            // Sem targetAgentId = broadcast para TODOS
            data: {
              chat: chatRecord as unknown as Record<string, unknown>,
            },
          },
          env.REDIS_URL,
        );
      }

      return chatRecord ?? { id: input.id, createdAt: input.createdAt };
    }),

  /**
   * Marcar conversa como não lida (definir unreadCount para 1)
   */
  markAsUnread: memberProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        createdAt: z.date(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Usar ChatPermissionsService para buscar currentAgent
      const permissionsService = new ChatPermissionsService(ctx.tenantDb);
      const currentAgent = await permissionsService.getCurrentAgent(ctx.session.user.id);

      // Usar ChatParticipantService para marcar como não lido
      const participantService = new ChatParticipantService(ctx.tenantDb);
      await participantService.markAsUnread(input.id, input.createdAt, currentAgent.id);

      // Buscar chat para retornar
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

      // Broadcast para atualizar a lista
      const organizationId = ctx.session.session.activeOrganizationId;
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

      return chatRecord;
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
      const organizationId = ctx.session.session.activeOrganizationId;
      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nenhuma organização ativa",
        });
      }

      // Usar ChatPermissionsService para buscar currentAgent
      const permissionsService = new ChatPermissionsService(ctx.tenantDb);
      const currentAgent = await permissionsService.getCurrentAgent(ctx.session.user.id);

      // Criar context
      const chatContext: ChatContext = {
        organizationId,
        tenantDb: ctx.tenantDb,
        agentId: currentAgent.id,
        userId: ctx.session.user.id,
      };

      // Usar ChatService para fazer toda a lógica
      const chatService = getChatService({
        redisUrl: env.REDIS_URL,
        getTenantConnection: tenantManager.getConnection.bind(tenantManager),
        getCatalogDb: () => ctx.db,
      });

      return await chatService.assign(chatContext, input);
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
      const organizationId = ctx.session.session.activeOrganizationId;
      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nenhuma organização ativa",
        });
      }

      // Usar ChatPermissionsService para buscar e validar currentAgent
      const permissionsService = new ChatPermissionsService(ctx.tenantDb);
      const currentAgent = await permissionsService.getCurrentAgent(ctx.session.user.id);

      // Buscar chat para verificar permissões
      const chatService = getChatService({
        redisUrl: env.REDIS_URL,
        getTenantConnection: tenantManager.getConnection.bind(tenantManager),
        getCatalogDb: () => ctx.db,
      });

      const chatContext: ChatContext = {
        organizationId,
        tenantDb: ctx.tenantDb,
        agentId: currentAgent.id,
        userId: ctx.session.user.id,
      };

      const currentChat = await chatService.getById(chatContext, input.id, input.createdAt);

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

      // Usar ChatService para fazer a transferência
      return await chatService.transfer(chatContext, {
        id: input.id,
        createdAt: input.createdAt,
        toAgentId: input.targetAgentId,
        toDepartmentId: input.targetDepartmentId,
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
        endingId: z.string().uuid().optional(),
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

      const permissionsService = new ChatPermissionsService(ctx.tenantDb);
      const currentAgent = await permissionsService.getCurrentAgent(ctx.session.user.id);

      const chatService = getChatService({
        redisUrl: env.REDIS_URL,
        getTenantConnection: tenantManager.getConnection.bind(tenantManager),
        getCatalogDb: () => ctx.db,
      });

      const chatContext: ChatContext = {
        organizationId,
        tenantDb: ctx.tenantDb,
        agentId: currentAgent.id,
        userId: ctx.session.user.id,
      };

      const currentChat = await chatService.getById(chatContext, input.id, input.createdAt);

      // Verificar permissões: owner, admin, ou assigned
      const isOwner = currentAgent.role === "owner";
      const isAdmin = currentAgent.role === "admin";
      const isAssigned = currentChat.assignedTo === currentAgent.id;

      if (!isOwner && !isAdmin && !isAssigned) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Apenas o agent responsável pelo atendimento pode finalizar este chat",
        });
      }

      return await chatService.close(chatContext, input);
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
      // Usar ChatService para reabrir chat
      const permissionsService = new ChatPermissionsService(ctx.tenantDb);
      const currentAgent = await permissionsService.getCurrentAgent(ctx.session.user.id);

      // Validar organizationId
      const organizationId = ctx.session.session.activeOrganizationId;
      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nenhuma organização ativa",
        });
      }

      const chatService = getChatService({
        redisUrl: env.REDIS_URL,
        getTenantConnection: tenantManager.getConnection.bind(tenantManager),
        getCatalogDb: () => ctx.db,
      });

      const chatContext: ChatContext = {
        organizationId,
        tenantDb: ctx.tenantDb,
        agentId: currentAgent.id,
        userId: ctx.session.user.id,
      };

      const updated = await chatService.reopen(chatContext, input.id, input.createdAt);

      // Criar mensagem de sistema (ainda não está no service)
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

      // Atualizar lastMessage
      await chatService.updateLastMessage(
        chatContext,
        updated.id,
        updated.createdAt,
        "Nova sessão criada",
        "system",
        "sent",
      );

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
