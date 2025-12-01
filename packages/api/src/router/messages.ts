import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { agent, and, attachment, channel, chat, chatParticipant, contact, desc, eq, ilike, lt, message, sql } from "@manylead/db";
import { EvolutionAPIClient } from "@manylead/evolution-api-client";
import { publishMessageEvent } from "@manylead/shared";

// Schema para upload de attachment (validação do frontend)
const uploadAttachmentSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  storagePath: z.string().min(1),
  publicUrl: z.string().url(),
  fileSize: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  duration: z.number().optional(),
});

import { env } from "../env";
import { getInternalMessageService } from "@manylead/messaging";
import type { MessageContext } from "@manylead/messaging";
import { createTRPCRouter, memberProcedure, ownerProcedure } from "../trpc";

/**
 * Messages Router
 *
 * Gerencia mensagens (WhatsApp e internas) do tenant
 */
export const messagesRouter = createTRPCRouter({
  /**
   * Listar mensagens de um chat com cursor-based pagination
   * Cursor = UUIDv7 (time-sortable)
   * Se cursor fornecido, retorna mensagens MAIS ANTIGAS que o cursor (para infinite scroll)
   */
  list: memberProcedure
    .input(
      z.object({
        chatId: z.string().uuid(),
        limit: z.number().min(1).max(100).default(50), // Para páginas subsequentes
        firstPageLimit: z.number().min(1).max(100).optional(), // Para primeira página (opcional)
        cursor: z.string().uuid().optional(), // UUIDv7 da mensagem mais antiga carregada
        includeDeleted: z.boolean().default(true), // Incluir deletadas por padrão para mostrar "Esta mensagem foi excluída"
      }),
    )
    .query(async ({ ctx, input }) => {
      const { chatId, cursor, includeDeleted } = input;

      // Usar firstPageLimit apenas quando NÃO há cursor (primeira página)
      const effectiveLimit = !cursor && input.firstPageLimit
        ? input.firstPageLimit
        : input.limit;

      // Buscar o agent do usuário atual para saber quem está logado
      const [currentAgent] = await ctx.tenantDb
        .select()
        .from(agent)
        .where(eq(agent.userId, ctx.session.user.id))
        .limit(1);

      // Construir where clause
      const conditions = [eq(message.chatId, chatId)];

      if (!includeDeleted) {
        conditions.push(eq(message.isDeleted, false));
      }

      // Se SEM cursor: buscar as N mais recentes
      // Se COM cursor: buscar mensagens MAIS ANTIGAS que o cursor (para infinite scroll ao scrollar pro topo)
      // UUIDv7 é time-sortable, então lt(message.id, cursor) funciona
      if (cursor) {
        conditions.push(lt(message.id, cursor));
      }

      const where = and(...conditions);

      // Buscar effectiveLimit + 1 para saber se há mais mensagens
      // Ordenar DESC primeiro para pegar as mais recentes (ou mais recentes antes do cursor)
      const items = await ctx.tenantDb
        .select({
          message,
          attachment,
        })
        .from(message)
        .leftJoin(attachment, eq(message.id, attachment.messageId))
        .where(where)
        .limit(effectiveLimit + 1)
        .orderBy(desc(message.id)); // DESC - pegar as mais recentes primeiro

      // Verificar se há próxima página
      const hasMore = items.length > effectiveLimit;
      const itemsToReturn = hasMore ? items.slice(0, effectiveLimit) : items;

      // Reverter para ASC (mais antigas primeira) - ordem de exibição
      const reversedItems = [...itemsToReturn].reverse();

      // CURSOR CALCULATION:
      // O cursor deve ser a mensagem MAIS ANTIGA que vamos RETORNAR (reversedItems[0])
      // Porque quando o cliente pedir a próxima página, usaremos lt(message.id, cursor)
      // para buscar mensagens MAIS ANTIGAS que essa
      // PORÉM: items[effectiveLimit] seria a próxima mensagem (a descartada)
      // Mas como já revertemos, reversedItems[0] é a mais antiga que mostramos
      // E queremos que a próxima página carregue mensagens ANTES dessa
      const nextCursor = hasMore ? reversedItems[0]?.message.id : undefined;

      // Mapear items para incluir se a mensagem é do usuário atual (isOwnMessage)
      const itemsWithOwnership = reversedItems.map((item) => ({
        ...item,
        isOwnMessage: currentAgent ? item.message.senderId === currentAgent.id : false,
      }));

      return {
        items: itemsWithOwnership,
        nextCursor,
        hasMore,
      };
    }),

  /**
   * Pesquisar mensagens dentro de um chat
   */
  search: memberProcedure
    .input(
      z.object({
        chatId: z.string().uuid(),
        query: z.string().min(1).max(200),
        limit: z.number().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { chatId, query, limit } = input;

      // Buscar o agent do usuário atual
      const [currentAgent] = await ctx.tenantDb
        .select()
        .from(agent)
        .where(eq(agent.userId, ctx.session.user.id))
        .limit(1);

      // Buscar mensagens que contenham o termo de busca
      const items = await ctx.tenantDb
        .select({
          message,
          attachment,
        })
        .from(message)
        .leftJoin(attachment, eq(message.id, attachment.messageId))
        .where(
          and(
            eq(message.chatId, chatId),
            eq(message.isDeleted, false),
            ilike(message.content, `%${query}%`),
          ),
        )
        .limit(limit)
        .orderBy(desc(message.id));

      // Mapear items para incluir se a mensagem é do usuário atual
      const itemsWithOwnership = items.map((item) => ({
        ...item,
        isOwnMessage: currentAgent ? item.message.senderId === currentAgent.id : false,
      }));

      return {
        items: itemsWithOwnership,
        query,
      };
    }),

  /**
   * Listar mensagens favoritas (starred) de um chat
   */
  listStarred: memberProcedure
    .input(
      z.object({
        chatId: z.string().uuid(),
        limit: z.number().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { chatId, limit } = input;

      // Buscar o agent do usuário atual
      const [currentAgent] = await ctx.tenantDb
        .select()
        .from(agent)
        .where(eq(agent.userId, ctx.session.user.id))
        .limit(1);

      // Buscar mensagens favoritas
      const items = await ctx.tenantDb
        .select({
          message,
          attachment,
        })
        .from(message)
        .leftJoin(attachment, eq(message.id, attachment.messageId))
        .where(
          and(
            eq(message.chatId, chatId),
            eq(message.isDeleted, false),
            eq(message.isStarred, true),
          ),
        )
        .limit(limit)
        .orderBy(desc(message.id));

      // Mapear items para incluir se a mensagem é do usuário atual
      const itemsWithOwnership = items.map((item) => ({
        ...item,
        isOwnMessage: currentAgent ? item.message.senderId === currentAgent.id : false,
      }));

      return {
        items: itemsWithOwnership,
      };
    }),

  /**
   * Buscar mensagens ao redor de uma mensagem específica (para navegação de busca)
   * Retorna N mensagens antes e N mensagens depois do ID fornecido
   */
  getContext: memberProcedure
    .input(
      z.object({
        chatId: z.string().uuid(),
        messageId: z.string().uuid(),
        before: z.number().min(0).max(50).default(20),
        after: z.number().min(0).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { chatId, messageId, before, after } = input;

      // Buscar o agent do usuário atual
      const [currentAgent] = await ctx.tenantDb
        .select()
        .from(agent)
        .where(eq(agent.userId, ctx.session.user.id))
        .limit(1);

      // Buscar mensagens ANTES do messageId (mais antigas - IDs menores)
      const beforeMessages = await ctx.tenantDb
        .select({
          message,
          attachment,
        })
        .from(message)
        .leftJoin(attachment, eq(message.id, attachment.messageId))
        .where(
          and(
            eq(message.chatId, chatId),
            eq(message.isDeleted, false),
            lt(message.id, messageId),
          ),
        )
        .limit(before)
        .orderBy(desc(message.id));

      // Buscar a mensagem alvo
      const [targetMessage] = await ctx.tenantDb
        .select({
          message,
          attachment,
        })
        .from(message)
        .leftJoin(attachment, eq(message.id, attachment.messageId))
        .where(
          and(
            eq(message.chatId, chatId),
            eq(message.id, messageId),
          ),
        )
        .limit(1);

      // Buscar mensagens DEPOIS do messageId (mais recentes - IDs maiores)
      const afterMessages = await ctx.tenantDb
        .select({
          message,
          attachment,
        })
        .from(message)
        .leftJoin(attachment, eq(message.id, attachment.messageId))
        .where(
          and(
            eq(message.chatId, chatId),
            eq(message.isDeleted, false),
            sql`${message.id} > ${messageId}`,
          ),
        )
        .limit(after)
        .orderBy(message.id);

      // Combinar: before (reversed) + target + after
      const allMessages = [
        ...beforeMessages.reverse(),
        ...(targetMessage ? [targetMessage] : []),
        ...afterMessages,
      ];

      // Mapear items para incluir se a mensagem é do usuário atual
      const itemsWithOwnership = allMessages.map((item) => ({
        ...item,
        isOwnMessage: currentAgent ? item.message.senderId === currentAgent.id : false,
      }));

      return {
        items: itemsWithOwnership,
        targetMessageId: messageId,
        hasMoreBefore: beforeMessages.length === before,
        hasMoreAfter: afterMessages.length === after,
      };
    }),

  /**
   * Buscar mensagem por ID
   */
  getById: memberProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        timestamp: z.date(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Message tem composite PK (id + timestamp)
      const [messageRecord] = await ctx.tenantDb
        .select({
          message,
          attachment,
        })
        .from(message)
        .leftJoin(attachment, eq(message.id, attachment.messageId))
        .where(
          and(eq(message.id, input.id), eq(message.timestamp, input.timestamp)),
        )
        .limit(1);

      if (!messageRecord) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Mensagem não encontrada",
        });
      }

      return messageRecord;
    }),

  /**
   * Enviar mensagem de texto (REFATORADO com MessageService)
   */
  sendText: memberProcedure
    .input(
      z.object({
        chatId: z.string().uuid(),
        content: z.string().min(1),
        tempId: z.string().uuid(),
        metadata: z.record(z.string(), z.unknown()).optional(),
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

      const userId = ctx.session.user.id;
      const userName = ctx.session.user.name;

      // Buscar agent do usuário
      const [currentAgent] = await ctx.tenantDb
        .select()
        .from(agent)
        .where(eq(agent.userId, userId))
        .limit(1);

      if (!currentAgent) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Agent não encontrado",
        });
      }

      // Inicializar MessageService
      const { tenantManager } = await import("../trpc");
      const messageService = getInternalMessageService({
        redisUrl: env.REDIS_URL,
        getTenantConnection: tenantManager.getConnection.bind(tenantManager),
        getCatalogDb: () => ctx.db,
      });

      // Criar MessageContext
      const messageContext: MessageContext = {
        organizationId,
        tenantDb: ctx.tenantDb,
        agentId: currentAgent.id,
        agentName: userName,
      };

      // Criar mensagem usando MessageService (cria local + espelha cross-org + emite eventos)
      const result = await messageService.createTextMessage(messageContext, {
        chatId: input.chatId,
        content: input.content,
        agentId: currentAgent.id,
        agentName: userName,
        metadata: input.metadata,
        repliedToMessageId: input.metadata?.repliedToMessageId as string | undefined,
        tempId: input.tempId,
      });

      const { message: newMessage, chat: chatRecord } = result;

      // Lógica adicional para chats intra-org (com initiatorAgentId)
      if (chatRecord.messageSource === "internal" && chatRecord.initiatorAgentId) {
        const isInitiator = currentAgent.id === chatRecord.initiatorAgentId;
        const now = new Date();

        // Buscar o outro participante (destinatário)
        const targetAgentId = isInitiator
          ? (await ctx.tenantDb
              .select()
              .from(contact)
              .where(eq(contact.id, chatRecord.contactId))
              .limit(1)
              .then((rows) => {
                const metadata = rows[0]?.metadata as { agentId?: string } | null;
                return metadata?.agentId;
              }))
          : chatRecord.initiatorAgentId;

        // Incrementar unreadCount APENAS do destinatário
        if (targetAgentId) {
          await ctx.tenantDb
            .update(chatParticipant)
            .set({
              unreadCount: sql`COALESCE(${chatParticipant.unreadCount}, 0) + 1`,
              updatedAt: now,
            })
            .where(
              and(
                eq(chatParticipant.chatId, input.chatId),
                eq(chatParticipant.chatCreatedAt, chatRecord.createdAt),
                eq(chatParticipant.agentId, targetAgentId),
              ),
            );
        }
      }

      return newMessage;
    }),

  /**
   * Envia mensagem com attachment (foto/vídeo)
   */
  sendWithAttachment: memberProcedure
    .input(
      z.object({
        chatId: z.string().uuid(),
        content: z.string().default(""),
        tempId: z.string().uuid(),
        attachment: uploadAttachmentSchema,
        metadata: z.record(z.string(), z.unknown()).optional(),
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

      const userId = ctx.session.user.id;

      // Buscar o agent do usuário logado
      const [currentAgent] = await ctx.tenantDb
        .select()
        .from(agent)
        .where(eq(agent.userId, userId))
        .limit(1);

      if (!currentAgent) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Agent não encontrado para o usuário",
        });
      }

      const { tenantManager } = await import("../trpc");
      const messageService = getInternalMessageService({
        redisUrl: env.REDIS_URL,
        getTenantConnection: tenantManager.getConnection.bind(tenantManager),
        getCatalogDb: () => ctx.db,
      });

      const messageContext: MessageContext = {
        organizationId,
        tenantDb: ctx.tenantDb,
        agentId: currentAgent.id,
        agentName: ctx.session.user.name,
      };

      // Determinar messageType
      let messageType: "image" | "video" | "audio" | "document" = "document";
      if (input.attachment.mimeType.startsWith("image/")) messageType = "image";
      else if (input.attachment.mimeType.startsWith("video/")) messageType = "video";
      else if (input.attachment.mimeType.startsWith("audio/")) messageType = "audio";

      // Criar mensagem com attachmentData
      const result = await messageService.createTextMessage(messageContext, {
        chatId: input.chatId,
        content: input.content || "", // ✅ Não salvar [image] se não tiver caption
        messageType,
        tempId: input.tempId,
        agentId: currentAgent.id,
        agentName: ctx.session.user.name,
        metadata: input.metadata,
        attachmentData: {
          fileName: input.attachment.fileName,
          mimeType: input.attachment.mimeType,
          mediaType: messageType,
          storagePath: input.attachment.storagePath,
          storageUrl: input.attachment.publicUrl,
          fileSize: input.attachment.fileSize ?? null,
          width: input.attachment.width ?? null,
          height: input.attachment.height ?? null,
          duration: input.attachment.duration ?? null,
        },
      });

      const { message: newMessage, chat: chatRecord } = result;

      // Lógica adicional para chats intra-org (com initiatorAgentId)
      if (chatRecord.messageSource === "internal" && chatRecord.initiatorAgentId) {
        const isInitiator = currentAgent.id === chatRecord.initiatorAgentId;
        const now = new Date();

        // Buscar o outro participante (destinatário)
        const targetAgentId = isInitiator
          ? (await ctx.tenantDb
              .select()
              .from(contact)
              .where(eq(contact.id, chatRecord.contactId))
              .limit(1)
              .then((rows) => {
                const metadata = rows[0]?.metadata as { agentId?: string } | null;
                return metadata?.agentId;
              }))
          : chatRecord.initiatorAgentId;

        // Incrementar unreadCount APENAS do destinatário
        if (targetAgentId) {
          await ctx.tenantDb
            .update(chatParticipant)
            .set({
              unreadCount: sql`COALESCE(${chatParticipant.unreadCount}, 0) + 1`,
              updatedAt: now,
            })
            .where(
              and(
                eq(chatParticipant.chatId, input.chatId),
                eq(chatParticipant.chatCreatedAt, chatRecord.createdAt),
                eq(chatParticipant.agentId, targetAgentId),
              ),
            );
        }
      }

      return newMessage;
    }),

  /**
   * Marcar todas as mensagens de um chat como lidas (bulk)
   * Apenas mensagens do contato (sender !== agent) que ainda não foram lidas
   */
  markAllAsRead: memberProcedure
    .input(
      z.object({
        chatId: z.string().uuid(),
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

      const userId = ctx.session.user.id;

      // Buscar o agent do usuário logado
      const [currentAgent] = await ctx.tenantDb
        .select()
        .from(agent)
        .where(eq(agent.userId, userId))
        .limit(1);

      if (!currentAgent) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Agent não encontrado para o usuário",
        });
      }

      const { tenantManager } = await import("../trpc");
      const messageService = getInternalMessageService({
        redisUrl: env.REDIS_URL,
        getTenantConnection: tenantManager.getConnection.bind(tenantManager),
        getCatalogDb: () => ctx.db,
      });

      const messageContext: MessageContext = {
        organizationId,
        tenantDb: ctx.tenantDb,
        agentId: currentAgent.id,
        agentName: ctx.session.user.name,
      };

      await messageService.markAllAsRead(messageContext, input.chatId);

      return { success: true };
    }),

  /**
   * Marcar mensagem como lida
   */
  markAsRead: memberProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        timestamp: z.date(),
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

      const [updated] = await ctx.tenantDb
        .update(message)
        .set({
          status: "read",
          readAt: new Date(),
        })
        .where(
          and(eq(message.id, input.id), eq(message.timestamp, input.timestamp)),
        )
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Mensagem não encontrada",
        });
      }

      // Emitir evento socket para atualizar status da mensagem
      await publishMessageEvent(
        {
          type: "message:updated",
          organizationId,
          chatId: updated.chatId,
          messageId: updated.id,
          data: {
            message: updated as unknown as Record<string, unknown>,
          },
        },
        env.REDIS_URL,
      );

      return updated;
    }),

  /**
   * Editar mensagem
   * Apenas mensagens do próprio agent podem ser editadas
   * Não pode editar se a mensagem já foi lida pelo destinatário
   */
  edit: memberProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        timestamp: z.coerce.date(),
        chatId: z.string().uuid(),
        content: z.string().min(1).max(4000),
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

      const userId = ctx.session.user.id;

      // Buscar agent do usuário logado
      const [currentAgent] = await ctx.tenantDb
        .select()
        .from(agent)
        .where(eq(agent.userId, userId))
        .limit(1);

      if (!currentAgent) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Agent não encontrado",
        });
      }

      // Verificar se o agent tem permissão para editar mensagens
      if (!currentAgent.permissions.messages.canEdit) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Você não tem permissão para editar mensagens",
        });
      }

      // Buscar mensagem
      const [existingMessage] = await ctx.tenantDb
        .select()
        .from(message)
        .where(
          and(eq(message.id, input.id), eq(message.timestamp, input.timestamp)),
        )
        .limit(1);

      if (!existingMessage) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Mensagem não encontrada",
        });
      }

      // Verificar se a mensagem pertence ao agent logado
      if (existingMessage.senderId !== currentAgent.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Você só pode editar suas próprias mensagens",
        });
      }

      // Verificar se a mensagem já foi lida
      if (existingMessage.readAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Não é possível editar mensagens que já foram lidas",
        });
      }

      // Verificar se a mensagem já foi deletada
      if (existingMessage.isDeleted) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Não é possível editar mensagens deletadas",
        });
      }

      const { tenantManager } = await import("../trpc");
      const messageService = getInternalMessageService({
        redisUrl: env.REDIS_URL,
        getTenantConnection: tenantManager.getConnection.bind(tenantManager),
        getCatalogDb: () => ctx.db,
      });

      const messageContext: MessageContext = {
        organizationId,
        tenantDb: ctx.tenantDb,
        agentId: currentAgent.id,
        agentName: ctx.session.user.name,
      };

      const updated = await messageService.editMessage(
        messageContext,
        input.id,
        input.timestamp,
        input.chatId,
        { content: input.content },
      );

      return updated;
    }),

  /**
   * Deletar mensagem (soft delete)
   * Apenas mensagens do próprio agent podem ser deletadas
   * Não pode deletar se a mensagem já foi lida pelo destinatário
   */
  delete: memberProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        timestamp: z.coerce.date(),
        chatId: z.string().uuid(),
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

      const userId = ctx.session.user.id;

      // Buscar agent do usuário logado
      const [currentAgent] = await ctx.tenantDb
        .select()
        .from(agent)
        .where(eq(agent.userId, userId))
        .limit(1);

      if (!currentAgent) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Agent não encontrado",
        });
      }

      // Verificar se o agent tem permissão para deletar mensagens
      if (!currentAgent.permissions.messages.canDelete) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Você não tem permissão para deletar mensagens",
        });
      }

      // Buscar mensagem
      const [existingMessage] = await ctx.tenantDb
        .select()
        .from(message)
        .where(
          and(eq(message.id, input.id), eq(message.timestamp, input.timestamp)),
        )
        .limit(1);

      if (!existingMessage) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Mensagem não encontrada",
        });
      }

      // Verificar se a mensagem pertence ao agent logado
      if (existingMessage.senderId !== currentAgent.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Você só pode deletar suas próprias mensagens",
        });
      }

      // Verificar se a mensagem tem mídia (attachment)
      const [messageAttachment] = await ctx.tenantDb
        .select()
        .from(attachment)
        .where(eq(attachment.messageId, input.id))
        .limit(1);

      const hasMedia = !!messageAttachment;

      // Verificar se a mensagem já foi lida
      // EXCETO para mídias: sempre pode deletar mensagens com attachment
      if (existingMessage.readAt && !hasMedia) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Não é possível deletar mensagens que já foram lidas",
        });
      }

      // Verificar se a mensagem já foi deletada
      if (existingMessage.isDeleted) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Esta mensagem já foi deletada",
        });
      }

      const { tenantManager } = await import("../trpc");
      const messageService = getInternalMessageService({
        redisUrl: env.REDIS_URL,
        getTenantConnection: tenantManager.getConnection.bind(tenantManager),
        getCatalogDb: () => ctx.db,
      });

      const messageContext: MessageContext = {
        organizationId,
        tenantDb: ctx.tenantDb,
        agentId: currentAgent.id,
        agentName: ctx.session.user.name,
      };

      await messageService.deleteMessage(
        messageContext,
        input.id,
        input.timestamp,
        input.chatId,
      );

      return { success: true };
    }),

  /**
   * Buscar mensagens por WhatsApp Message ID (evitar duplicatas)
   */
  findByWhatsappId: ownerProcedure
    .input(z.object({ whatsappMessageId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [existing] = await ctx.tenantDb
        .select()
        .from(message)
        .where(eq(message.whatsappMessageId, input.whatsappMessageId))
        .limit(1);

      return existing ?? null;
    }),

  /**
   * Enviar mensagem de texto para WhatsApp
   */
  sendWhatsApp: ownerProcedure
    .input(
      z.object({
        chatId: z.string().uuid(),
        createdAt: z.date(), // Para composite PK do chat
        content: z.string().min(1),
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

      const userId = ctx.session.user.id;

      // 1. Buscar o agent do usuário logado
      const [currentAgent] = await ctx.tenantDb
        .select()
        .from(agent)
        .where(eq(agent.userId, userId))
        .limit(1);

      if (!currentAgent) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Agent não encontrado para o usuário",
        });
      }

      // 2. Buscar chat com canal e contato
      const [chatRecord] = await ctx.tenantDb
        .select({
          chat,
          contact,
          channel,
        })
        .from(chat)
        .innerJoin(contact, eq(chat.contactId, contact.id))
        .leftJoin(channel, eq(chat.channelId, channel.id))
        .where(
          and(
            eq(chat.id, input.chatId),
            eq(chat.createdAt, input.createdAt),
            eq(chat.messageSource, "whatsapp"),
          ),
        )
        .limit(1);

      if (!chatRecord) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Chat não encontrado",
        });
      }

      if (!chatRecord.channel) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Chat não possui canal configurado",
        });
      }

      const now = new Date();

      // 3. Criar mensagem no DB com status "pending"
      const [newMessage] = await ctx.tenantDb
        .insert(message)
        .values({
          chatId: input.chatId,
          messageSource: "whatsapp",
          sender: "agent",
          senderId: currentAgent.id,
          messageType: "text",
          content: input.content,
          status: "pending",
          timestamp: now,
        })
        .returning();

      if (!newMessage) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Falha ao criar mensagem",
        });
      }

      try {
        // 4. Enviar via Evolution API
        const evolutionClient = new EvolutionAPIClient(
          env.EVOLUTION_API_URL,
          env.EVOLUTION_API_KEY,
        );

        if (!chatRecord.contact.phoneNumber) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Contato não possui número de telefone",
          });
        }

        const result = await evolutionClient.message.sendText(
          chatRecord.channel.evolutionInstanceName,
          {
            number: chatRecord.contact.phoneNumber,
            text: input.content,
          },
        );

        // 5. Atualizar mensagem com whatsappMessageId e status "sent"
        await ctx.tenantDb
          .update(message)
          .set({
            whatsappMessageId: result.key.id,
            status: "sent",
            sentAt: new Date(),
          })
          .where(
            and(
              eq(message.id, newMessage.id),
              eq(message.timestamp, newMessage.timestamp),
            ),
          );

        // 6. Atualizar chat (lastMessage, totalMessages)
        await ctx.tenantDb
          .update(chat)
          .set({
            lastMessageAt: now,
            lastMessageContent: input.content,
            lastMessageSender: "agent",
            lastMessageStatus: "pending",
            totalMessages: sql`${chat.totalMessages} + 1`,
            updatedAt: now,
          })
          .where(
            and(
              eq(chat.id, input.chatId),
              eq(chat.createdAt, input.createdAt),
            ),
          );

        // 7. TODO: Emitir evento Socket.io para atualizar UI em tempo real

        return {
          ...newMessage,
          whatsappMessageId: result.key.id,
          status: "sent" as const,
          sentAt: new Date(),
        };
      } catch (error) {
        // Se falhar, marcar mensagem como failed
        await ctx.tenantDb
          .update(message)
          .set({
            status: "failed",
            errorMessage:
              error instanceof Error ? error.message : "Erro desconhecido",
          })
          .where(
            and(
              eq(message.id, newMessage.id),
              eq(message.timestamp, newMessage.timestamp),
            ),
          );

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? `Falha ao enviar mensagem: ${error.message}`
              : "Falha ao enviar mensagem",
        });
      }
    }),

  /**
   * Enviar mensagem com mídia para WhatsApp
   */
  sendWhatsAppMedia: ownerProcedure
    .input(
      z.object({
        chatId: z.string().uuid(),
        createdAt: z.date(), // Para composite PK do chat
        mediaUrl: z.string().url(), // URL pública do arquivo no R2
        mimeType: z.string().min(1),
        fileName: z.string().min(1),
        caption: z.string().optional(),
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

      const userId = ctx.session.user.id;

      // 1. Buscar o agent do usuário logado
      const [currentAgent] = await ctx.tenantDb
        .select()
        .from(agent)
        .where(eq(agent.userId, userId))
        .limit(1);

      if (!currentAgent) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Agent não encontrado para o usuário",
        });
      }

      // 2. Buscar chat com canal e contato
      const [chatRecord] = await ctx.tenantDb
        .select({
          chat,
          contact,
          channel,
        })
        .from(chat)
        .innerJoin(contact, eq(chat.contactId, contact.id))
        .leftJoin(channel, eq(chat.channelId, channel.id))
        .where(
          and(
            eq(chat.id, input.chatId),
            eq(chat.createdAt, input.createdAt),
            eq(chat.messageSource, "whatsapp"),
          ),
        )
        .limit(1);

      if (!chatRecord) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Chat não encontrado",
        });
      }

      if (!chatRecord.channel) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Chat não possui canal configurado",
        });
      }

      const now = new Date();

      // Determinar tipo de mídia baseado no mimeType
      let messageType: "image" | "video" | "audio" | "document" = "document";
      if (input.mimeType.startsWith("image/")) messageType = "image";
      else if (input.mimeType.startsWith("video/")) messageType = "video";
      else if (input.mimeType.startsWith("audio/")) messageType = "audio";

      // Determinar mediatype para Evolution API
      let evolutionMediaType: "image" | "video" | "audio" | "document" =
        "document";
      if (input.mimeType.startsWith("image/")) evolutionMediaType = "image";
      else if (input.mimeType.startsWith("video/")) evolutionMediaType = "video";
      else if (input.mimeType.startsWith("audio/")) evolutionMediaType = "audio";

      // 3. Criar mensagem no DB com status "pending"
      const [newMessage] = await ctx.tenantDb
        .insert(message)
        .values({
          chatId: input.chatId,
          messageSource: "whatsapp",
          sender: "agent",
          senderId: currentAgent.id,
          messageType,
          content: input.caption ?? `[${messageType}]`,
          status: "pending",
          timestamp: now,
        })
        .returning();

      if (!newMessage) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Falha ao criar mensagem",
        });
      }

      // 4. Criar attachment no DB
      const [newAttachment] = await ctx.tenantDb
        .insert(attachment)
        .values({
          messageId: newMessage.id,
          fileName: input.fileName,
          mimeType: input.mimeType,
          mediaType: messageType,
          storagePath: input.mediaUrl.replace(env.R2_PUBLIC_URL + "/", ""),
          storageUrl: input.mediaUrl,
          downloadStatus: "completed", // Já está no R2
        })
        .returning();

      try {
        // 5. Enviar via Evolution API
        const evolutionClient = new EvolutionAPIClient(
          env.EVOLUTION_API_URL,
          env.EVOLUTION_API_KEY,
        );

        if (!chatRecord.contact.phoneNumber) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Contato não possui número de telefone",
          });
        }

        const result = await evolutionClient.message.sendMedia(
          chatRecord.channel.evolutionInstanceName,
          {
            number: chatRecord.contact.phoneNumber,
            media: input.mediaUrl, // Evolution aceita URL pública
            mediatype: evolutionMediaType,
            caption: input.caption,
            fileName: input.fileName,
          },
        );

        // 6. Atualizar mensagem com whatsappMessageId e status "sent"
        await ctx.tenantDb
          .update(message)
          .set({
            whatsappMessageId: result.key.id,
            status: "sent",
            sentAt: new Date(),
          })
          .where(
            and(
              eq(message.id, newMessage.id),
              eq(message.timestamp, newMessage.timestamp),
            ),
          );

        // 7. Atualizar chat (lastMessage, totalMessages)
        await ctx.tenantDb
          .update(chat)
          .set({
            lastMessageAt: now,
            lastMessageContent: input.caption ?? `[${messageType}]`,
            lastMessageSender: "agent",
            lastMessageStatus: "pending",
            totalMessages: sql`${chat.totalMessages} + 1`,
            updatedAt: now,
          })
          .where(
            and(
              eq(chat.id, input.chatId),
              eq(chat.createdAt, input.createdAt),
            ),
          );

        // 7. TODO: Emitir evento Socket.io para atualizar UI em tempo real

        return {
          message: {
            ...newMessage,
            whatsappMessageId: result.key.id,
            status: "sent" as const,
            sentAt: new Date(),
          },
          attachment: newAttachment,
        };
      } catch (error) {
        // Se falhar, marcar mensagem como failed
        await ctx.tenantDb
          .update(message)
          .set({
            status: "failed",
            errorMessage:
              error instanceof Error ? error.message : "Erro desconhecido",
          })
          .where(
            and(
              eq(message.id, newMessage.id),
              eq(message.timestamp, newMessage.timestamp),
            ),
          );

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? `Falha ao enviar mídia: ${error.message}`
              : "Falha ao enviar mídia",
        });
      }
    }),

  /**
   * Toggle star (favoritar) uma mensagem
   */
  toggleStar: memberProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        timestamp: z.date(),
        isStarred: z.boolean(),
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

      // Atualizar mensagem
      const [updated] = await ctx.tenantDb
        .update(message)
        .set({
          isStarred: input.isStarred,
        })
        .where(
          and(
            eq(message.id, input.id),
            eq(message.timestamp, input.timestamp),
          ),
        )
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Mensagem não encontrada",
        });
      }

      // Emitir evento para propagar para outros agents
      await publishMessageEvent(
        {
          type: "message:updated",
          organizationId,
          chatId: updated.chatId,
          messageId: updated.id,
          data: {
            message: updated as unknown as Record<string, unknown>,
          },
        },
        env.REDIS_URL,
      );

      return updated;
    }),

  /**
   * Adicionar comentário interno (mensagem de sistema visível apenas para agents)
   */
  addComment: memberProcedure
    .input(
      z.object({
        chatId: z.string().uuid(),
        content: z.string().min(1).max(2000),
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

      const userId = ctx.session.user.id;
      const now = new Date();

      // Buscar agent do usuário logado
      const [currentAgent] = await ctx.tenantDb
        .select()
        .from(agent)
        .where(eq(agent.userId, userId))
        .limit(1);

      if (!currentAgent) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Agent não encontrado",
        });
      }

      // Criar mensagem de comentário (visível apenas para agents)
      const agentName = ctx.session.user.name;

      const [commentMessage] = await ctx.tenantDb
        .insert(message)
        .values({
          chatId: input.chatId,
          messageSource: "internal",
          sender: "system",
          senderId: null,
          messageType: "comment",
          content: input.content,
          metadata: {
            agentId: currentAgent.id,
            agentName,
          },
          status: "read",
          visibleTo: "agents_only", // Apenas agents podem ver
          timestamp: now,
          sentAt: now,
          readAt: now,
        })
        .returning();

      if (!commentMessage) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erro ao criar comentário",
        });
      }

      // Emitir evento socket para propagar para outros agents
      await publishMessageEvent(
        {
          type: "message:new",
          organizationId,
          chatId: input.chatId,
          messageId: commentMessage.id,
          senderId: currentAgent.id,
          data: {
            message: commentMessage as unknown as Record<string, unknown>,
          },
        },
        env.REDIS_URL,
      );

      return commentMessage;
    }),

  /**
   * Deletar comentário interno
   */
  deleteComment: memberProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        chatId: z.string().uuid(),
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

      const userId = ctx.session.user.id;

      // Buscar agent do usuário logado
      const [currentAgent] = await ctx.tenantDb
        .select()
        .from(agent)
        .where(eq(agent.userId, userId))
        .limit(1);

      if (!currentAgent) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Agent não encontrado",
        });
      }

      // Buscar mensagem para verificar se é um comentário e se pertence ao agent
      const [existingMessage] = await ctx.tenantDb
        .select()
        .from(message)
        .where(eq(message.id, input.id))
        .limit(1);

      if (!existingMessage) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Comentário não encontrado",
        });
      }

      if (existingMessage.messageType !== "comment") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Esta mensagem não é um comentário",
        });
      }

      // Verificar se o comentário pertence ao agent logado
      const metadata = existingMessage.metadata as { agentId?: string } | null;
      if (metadata?.agentId !== currentAgent.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Você não tem permissão para deletar este comentário",
        });
      }

      // Deletar comentário
      await ctx.tenantDb
        .delete(message)
        .where(eq(message.id, input.id));

      // Emitir evento socket para propagar para outros agents
      await publishMessageEvent(
        {
          type: "message:deleted",
          organizationId,
          chatId: input.chatId,
          messageId: input.id,
          senderId: currentAgent.id,
          data: {
            message: existingMessage as unknown as Record<string, unknown>,
          },
        },
        env.REDIS_URL,
      );

      return { success: true };
    }),
});
