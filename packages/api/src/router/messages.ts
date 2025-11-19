import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { agent, and, attachment, channel, chat, contact, desc, eq, lt, message, sql } from "@manylead/db";
import { EvolutionAPIClient } from "@manylead/evolution-api-client";
import { publishMessageEvent } from "@manylead/shared";

import { env } from "../env";
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
        includeDeleted: z.boolean().default(false),
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
   * Enviar mensagem de texto
   */
  sendText: memberProcedure
    .input(
      z.object({
        chatId: z.string().uuid(),
        content: z.string().min(1),
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
      const now = new Date();

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

      // Formatar mensagem com assinatura: **Nome**\nConteúdo
      const formattedContent = `**${userName}**\n${input.content}`;

      // Criar mensagem (drizzle gera ID automaticamente)
      const [newMessage] = await ctx.tenantDb
        .insert(message)
        .values({
          chatId: input.chatId,
          messageSource: "internal",
          sender: "agent",
          senderId: currentAgent.id,
          messageType: "text",
          content: formattedContent,
          metadata: input.metadata,
          status: "sent",
          timestamp: now,
          sentAt: now,
        })
        .returning();

      if (!newMessage) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Falha ao criar mensagem",
        });
      }

      // Atualizar chat (lastMessage, totalMessages)
      await ctx.tenantDb
        .update(chat)
        .set({
          lastMessageAt: now,
          lastMessageContent: input.content,
          lastMessageSender: "agent",
          totalMessages: sql`${chat.totalMessages} + 1`,
          updatedAt: now,
        })
        .where(eq(chat.id, input.chatId));

      // Emitir evento Socket.io para atualizar UI em tempo real
      await publishMessageEvent(
        {
          type: "message:new",
          organizationId,
          chatId: input.chatId,
          messageId: newMessage.id,
          data: {
            message: newMessage as unknown as Record<string, unknown>,
          },
        },
        env.REDIS_URL,
      );

      // TODO: Se for WhatsApp, enfileirar job para enviar via Evolution API

      return newMessage;
    }),

  /**
   * Marcar mensagem como lida
   */
  markAsRead: ownerProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        timestamp: z.date(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
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

      return updated;
    }),

  /**
   * Deletar mensagem (soft delete)
   */
  delete: ownerProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        timestamp: z.date(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.tenantDb
        .update(message)
        .set({
          isDeleted: true,
        })
        .where(
          and(eq(message.id, input.id), eq(message.timestamp, input.timestamp)),
        )
        .returning();

      if (!deleted) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Mensagem não encontrada",
        });
      }

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
});
