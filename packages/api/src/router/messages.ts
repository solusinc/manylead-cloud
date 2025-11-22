import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { agent, and, attachment, channel, chat, chatParticipant, contact, desc, eq, lt, message, or, organization, sql } from "@manylead/db";
import { EvolutionAPIClient } from "@manylead/evolution-api-client";
import { publishChatEvent, publishMessageEvent } from "@manylead/shared";

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
        tempId: z.string().uuid(), // Client-generated UUID for deduplication
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

      // Extrair repliedToMessageId do metadata (se existir)
      const repliedToMessageId = input.metadata?.repliedToMessageId as string | undefined;

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
          repliedToMessageId: repliedToMessageId ?? null,
          metadata: {
            ...input.metadata,
            tempId: input.tempId, // Save client tempId for deduplication
          },
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

      // Buscar chat para verificar se é interno
      const [chatRecord] = await ctx.tenantDb
        .select()
        .from(chat)
        .where(eq(chat.id, input.chatId))
        .limit(1);

      if (!chatRecord) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Chat não encontrado",
        });
      }

      // Se for a PRIMEIRA MENSAGEM de um chat cross-org, criar chat espelhado na org target
      if (chatRecord.messageSource === "internal" && chatRecord.totalMessages === 0) {
        // Buscar contact para pegar targetOrganizationId
        const [contactRecord] = await ctx.tenantDb
          .select()
          .from(contact)
          .where(eq(contact.id, chatRecord.contactId))
          .limit(1);

        if (contactRecord?.metadata?.targetOrganizationId) {
          const targetOrgId = contactRecord.metadata.targetOrganizationId;

          // Buscar dados da org source para criar contact na target
          const [sourceOrg] = await ctx.db
            .select()
            .from(organization)
            .where(eq(organization.id, organizationId))
            .limit(1);

          if (sourceOrg) {
            const { tenantManager } = await import("../trpc");
            const targetTenantDb = await tenantManager.getConnection(targetOrgId);

            // Criar/buscar contact representando a org source no banco da target
            const existingContacts = await targetTenantDb
              .select()
              .from(contact)
              .where(eq(contact.organizationId, targetOrgId));

            let sourceContact = existingContacts.find(
              (c) =>
                c.metadata?.source === "internal" &&
                c.metadata.targetOrganizationId === organizationId,
            );

            if (!sourceContact) {
              const [newContact] = await targetTenantDb
                .insert(contact)
                .values({
                  organizationId: targetOrgId,
                  phoneNumber: null,
                  name: sourceOrg.name,
                  avatar: sourceOrg.logo ?? undefined,
                  metadata: {
                    source: "internal",
                    targetOrganizationId: organizationId,
                    targetOrganizationName: sourceOrg.name,
                    targetOrganizationInstanceCode: sourceOrg.instanceCode,
                    firstMessageAt: now,
                  },
                })
                .returning();

              sourceContact = newContact;
            }

            if (sourceContact) {
              // Criar chat espelhado na org target com status pending
              const [mirroredChat] = await targetTenantDb
                .insert(chat)
                .values({
                  organizationId: targetOrgId,
                  contactId: sourceContact.id,
                  channelId: null,
                  messageSource: "internal",
                  initiatorAgentId: null,
                  assignedTo: null,
                  status: "pending",
                  createdAt: now,
                  updatedAt: now,
                  lastMessageAt: now,
                  lastMessageContent: input.content,
                  lastMessageSender: "agent",
                  totalMessages: 1,
                  unreadCount: 1,
                })
                .returning();

              if (mirroredChat) {
                // Criar mensagem espelhada na org target
                await targetTenantDb.insert(message).values({
                  chatId: mirroredChat.id,
                  messageSource: "internal",
                  sender: "agent",
                  senderId: null, // Null porque é de outra org
                  messageType: "text",
                  content: formattedContent,
                  metadata: input.metadata,
                  status: "sent",
                  timestamp: now,
                  sentAt: now,
                });

                // Broadcast para TODA a org target
                await publishChatEvent(
                  {
                    type: "chat:created",
                    organizationId: targetOrgId,
                    chatId: mirroredChat.id,
                    targetAgentId: undefined, // Broadcast para todos
                    data: {
                      chat: mirroredChat as unknown as Record<string, unknown>,
                      contact: sourceContact as unknown as Record<string, unknown>,
                    },
                  },
                  env.REDIS_URL,
                );
              }
            }
          }
        }
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

      // Se for mensagem SUBSEQUENTE de um chat cross-org, espelhar na org target
      if (chatRecord.messageSource === "internal" && chatRecord.totalMessages >= 1) {
        // Buscar contact para pegar targetOrganizationId
        const [contactRecord] = await ctx.tenantDb
          .select()
          .from(contact)
          .where(eq(contact.id, chatRecord.contactId))
          .limit(1);

        if (contactRecord?.metadata?.targetOrganizationId) {
          const targetOrgId = contactRecord.metadata.targetOrganizationId;

          const { tenantManager } = await import("../trpc");
          const targetTenantDb = await tenantManager.getConnection(targetOrgId);

          // Buscar contact na org target que representa a org source
          const targetContacts = await targetTenantDb
            .select()
            .from(contact)
            .where(eq(contact.organizationId, targetOrgId));

          const sourceContact = targetContacts.find(
            (c) =>
              c.metadata?.source === "internal" &&
              c.metadata.targetOrganizationId === organizationId,
          );

          if (sourceContact) {
            // Buscar chat espelhado na org target que esteja ATIVO (pending ou open)
            // Se o chat estiver fechado, criar uma nova sessão
            let mirroredChat = await targetTenantDb
              .select()
              .from(chat)
              .where(
                and(
                  eq(chat.messageSource, "internal"),
                  eq(chat.contactId, sourceContact.id),
                  or(eq(chat.status, "pending"), eq(chat.status, "open")),
                ),
              )
              .limit(1)
              .then((rows) => rows[0]);

            // Se não encontrar chat ativo, criar uma nova sessão
            if (!mirroredChat) {
              const now = new Date();

              // Criar novo chat na org target
              const [newChat] = await targetTenantDb
                .insert(chat)
                .values({
                  organizationId: targetOrgId,
                  contactId: sourceContact.id,
                  messageSource: "internal",
                  status: "pending",
                  assignedTo: null,
                  unreadCount: 0,
                  totalMessages: 0,
                  createdAt: now,
                  updatedAt: now,
                })
                .returning();

              if (!newChat) {
                throw new TRPCError({
                  code: "INTERNAL_SERVER_ERROR",
                  message: "Failed to create mirrored chat in target organization",
                });
              }

              mirroredChat = newChat;

              // Broadcast chat:created para a org target
              await publishChatEvent(
                {
                  type: "chat:created",
                  organizationId: targetOrgId,
                  chatId: newChat.id,
                  targetAgentId: undefined,
                  data: {
                    chat: newChat as unknown as Record<string, unknown>,
                    contact: sourceContact as unknown as Record<string, unknown>,
                  },
                },
                env.REDIS_URL,
              );

              console.log(
                `[messages.create] Nova sessão criada na org target ${targetOrgId}: chat ${newChat.id}`,
              );
            }

            // Criar mensagem espelhada na org target
            const [mirroredMessage] = await targetTenantDb
              .insert(message)
              .values({
                chatId: mirroredChat.id,
                messageSource: "internal",
                sender: "agent",
                senderId: null,
                messageType: "text",
                content: formattedContent,
                metadata: input.metadata,
                status: "sent",
                timestamp: now,
                sentAt: now,
              })
              .returning();

            // Atualizar lastMessage do chat espelhado
            if (mirroredChat.assignedTo) {
              // Chat ASSIGNED: NÃO incrementar chat.unreadCount, apenas incrementar participants
              await targetTenantDb
                .update(chat)
                .set({
                  lastMessageAt: now,
                  lastMessageContent: input.content,
                  lastMessageSender: "agent",
                  totalMessages: sql`${chat.totalMessages} + 1`,
                  // NÃO incrementar unreadCount
                  updatedAt: now,
                })
                .where(eq(chat.id, mirroredChat.id));

              // Incrementar unreadCount de TODOS os participants
              await targetTenantDb
                .update(chatParticipant)
                .set({
                  unreadCount: sql`COALESCE(${chatParticipant.unreadCount}, 0) + 1`,
                  updatedAt: now,
                })
                .where(
                  and(
                    eq(chatParticipant.chatId, mirroredChat.id),
                    eq(chatParticipant.chatCreatedAt, mirroredChat.createdAt),
                  ),
                );
            } else {
              // Chat PENDING: incrementar chat.unreadCount
              await targetTenantDb
                .update(chat)
                .set({
                  lastMessageAt: now,
                  lastMessageContent: input.content,
                  lastMessageSender: "agent",
                  totalMessages: sql`${chat.totalMessages} + 1`,
                  unreadCount: sql`${chat.unreadCount} + 1`,
                  updatedAt: now,
                })
                .where(eq(chat.id, mirroredChat.id));
            }

            // Broadcast mensagem para a org target com o ID correto
            if (mirroredMessage) {
              await publishMessageEvent(
                {
                  type: "message:new",
                  organizationId: targetOrgId,
                  chatId: mirroredChat.id,
                  messageId: mirroredMessage.id,
                  senderId: undefined,
                  data: {
                    message: mirroredMessage as unknown as Record<string, unknown>,
                  },
                },
                env.REDIS_URL,
              );
            }
          }
        }
      }

      // Se for chat interno, enviar evento personalizado para cada participante
      if (chatRecord.messageSource === "internal" && chatRecord.initiatorAgentId) {
        const isInitiator = currentAgent.id === chatRecord.initiatorAgentId;

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

        // Incrementar unreadCount APENAS do destinatário (não do sender)
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

        if (targetAgentId) {
          // Enviar evento APENAS para o outro participante
          await publishMessageEvent(
            {
              type: "message:new",
              organizationId,
              chatId: input.chatId,
              messageId: newMessage.id,
              senderId: currentAgent.id,
              targetAgentId, // Evento privado
              data: {
                message: newMessage as unknown as Record<string, unknown>,
              },
            },
            env.REDIS_URL,
          );
        }
      } else {
        // Chat WhatsApp - broadcast para toda a org
        await publishMessageEvent(
          {
            type: "message:new",
            organizationId,
            chatId: input.chatId,
            messageId: newMessage.id,
            senderId: currentAgent.id,
            data: {
              message: newMessage as unknown as Record<string, unknown>,
            },
          },
          env.REDIS_URL,
        );
      }

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
});
