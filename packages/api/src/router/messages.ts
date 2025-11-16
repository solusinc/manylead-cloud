import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { and, attachment, channel, chat, contact, count, desc, eq, message, sql } from "@manylead/db";
import { EvolutionAPIClient } from "@manylead/evolution-api-client";

import { env } from "../env";
import { createTRPCRouter, ownerProcedure } from "../trpc";

/**
 * Messages Router
 *
 * Gerencia mensagens (WhatsApp e internas) do tenant
 */
export const messagesRouter = createTRPCRouter({
  /**
   * Listar mensagens de um chat com paginação
   */
  list: ownerProcedure
    .input(
      z.object({
        chatId: z.string().uuid(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
        includeDeleted: z.boolean().default(false),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { chatId, limit, offset, includeDeleted } = input;

      // Construir where clause
      const conditions = [eq(message.chatId, chatId)];

      if (!includeDeleted) {
        conditions.push(eq(message.isDeleted, false));
      }

      const where = and(...conditions);

      // Executar queries em paralelo
      const [items, totalResult] = await Promise.all([
        ctx.tenantDb
          .select({
            message,
            attachment,
          })
          .from(message)
          .leftJoin(attachment, eq(message.id, attachment.messageId))
          .where(where)
          .limit(limit)
          .offset(offset)
          .orderBy(desc(message.timestamp)),
        ctx.tenantDb.select({ count: count() }).from(message).where(where),
      ]);

      return {
        items,
        total: totalResult[0]?.count ?? 0,
        limit,
        offset,
      };
    }),

  /**
   * Buscar mensagem por ID
   */
  getById: ownerProcedure
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
  sendText: ownerProcedure
    .input(
      z.object({
        chatId: z.string().uuid(),
        content: z.string().min(1),
        senderId: z.string().uuid(),
        sender: z.enum(["agent", "system"]),
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

      const now = new Date();

      // Criar mensagem (drizzle gera ID automaticamente)
      const [newMessage] = await ctx.tenantDb
        .insert(message)
        .values({
          chatId: input.chatId,
          messageSource: "internal",
          sender: input.sender,
          senderId: input.senderId,
          messageType: "text",
          content: input.content,
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

      // TODO: Emitir evento Socket.io para atualizar UI em tempo real
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

      // 1. Buscar chat com canal e contato
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

      // 2. Criar mensagem no DB com status "pending"
      const [newMessage] = await ctx.tenantDb
        .insert(message)
        .values({
          chatId: input.chatId,
          messageSource: "whatsapp",
          sender: "agent",
          senderId: userId,
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
        // 3. Enviar via Evolution API
        const evolutionClient = new EvolutionAPIClient(
          env.EVOLUTION_API_URL,
          env.EVOLUTION_API_KEY,
        );

        const result = await evolutionClient.message.sendText(
          chatRecord.channel.evolutionInstanceName,
          {
            number: chatRecord.contact.phoneNumber,
            text: input.content,
          },
        );

        // 4. Atualizar mensagem com whatsappMessageId e status "sent"
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

        // 5. Atualizar chat (lastMessage, totalMessages)
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

        // 6. TODO: Emitir evento Socket.io para atualizar UI em tempo real

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

      // 1. Buscar chat com canal e contato
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

      // 2. Criar mensagem no DB com status "pending"
      const [newMessage] = await ctx.tenantDb
        .insert(message)
        .values({
          chatId: input.chatId,
          messageSource: "whatsapp",
          sender: "agent",
          senderId: userId,
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

      // 3. Criar attachment no DB
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
        // 4. Enviar via Evolution API
        const evolutionClient = new EvolutionAPIClient(
          env.EVOLUTION_API_URL,
          env.EVOLUTION_API_KEY,
        );

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
