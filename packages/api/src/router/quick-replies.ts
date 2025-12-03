import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  agent,
  and,
  count,
  db,
  desc,
  eq,
  ilike,
  inArray,
  insertQuickReplySchema,
  or,
  quickReply,
  scheduledMessage,
  selectQuickReplySchema,
  sql,
  updateQuickReplySchema,
} from "@manylead/db";
import type { QuickReplyMessage } from "@manylead/db";
import { extractKeyFromUrl, storage } from "@manylead/storage";

/**
 * Extrai o conteúdo de preview da primeira mensagem de texto
 */
function getContentPreview(messages: QuickReplyMessage[]): string {
  const firstTextMessage = messages.find((m) => m.type === "text");
  return firstTextMessage?.content ?? "";
}

import { createQueue } from "@manylead/clients/queue";
import { getRedisClient } from "@manylead/clients/redis";
import { env } from "../env";
import { getInternalMessageService } from "@manylead/messaging";

import { createTRPCRouter, memberProcedure, ownerProcedure, tenantManager } from "../trpc";

/**
 * Quick Replies Router
 *
 * Gerencia respostas rápidas para agilizar o atendimento
 */
export const quickRepliesRouter = createTRPCRouter({
  /**
   * List all quick replies accessible by the current user
   * Returns: organization-wide + user's private replies
   */
  list: memberProcedure.query(async ({ ctx }) => {
    const organizationId = ctx.session.session.activeOrganizationId;
    const userId = ctx.session.user.id;

    if (!organizationId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Nenhuma organização ativa",
      });
    }

    const tenantDb = await tenantManager.getConnection(organizationId);

    const quickReplies = await tenantDb
      .select()
      .from(quickReply)
      .where(
        and(
          eq(quickReply.organizationId, organizationId),
          eq(quickReply.isActive, true),
          or(
            eq(quickReply.visibility, "organization"),
            and(eq(quickReply.visibility, "private"), eq(quickReply.createdBy, userId)),
          ),
        ),
      )
      .orderBy(desc(quickReply.usageCount), quickReply.title);

    return quickReplies.map((qr) => selectQuickReplySchema.parse(qr));
  }),

  /**
   * List all quick replies for admin (owners see all, members see own)
   */
  listAdmin: memberProcedure.query(async ({ ctx }) => {
    const organizationId = ctx.session.session.activeOrganizationId;
    const userId = ctx.session.user.id;
    const userRole = ctx.agent.role;

    if (!organizationId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Nenhuma organização ativa",
      });
    }

    const tenantDb = await tenantManager.getConnection(organizationId);

    // Owners veem todas, members veem apenas as próprias
    const isOwnerOrAdmin = userRole === "owner" || userRole === "admin";

    const quickReplies = await tenantDb
      .select()
      .from(quickReply)
      .where(
        isOwnerOrAdmin
          ? eq(quickReply.organizationId, organizationId)
          : and(eq(quickReply.organizationId, organizationId), eq(quickReply.createdBy, userId)),
      )
      .orderBy(desc(quickReply.createdAt));

    return quickReplies.map((qr) => selectQuickReplySchema.parse(qr));
  }),

  /**
   * Get quick reply by ID
   */
  getById: memberProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.session.session.activeOrganizationId;
      const userId = ctx.session.user.id;
      const userRole = ctx.agent.role;

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nenhuma organização ativa",
        });
      }

      const tenantDb = await tenantManager.getConnection(organizationId);

      const [result] = await tenantDb
        .select()
        .from(quickReply)
        .where(and(eq(quickReply.id, input.id), eq(quickReply.organizationId, organizationId)))
        .limit(1);

      if (!result) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Resposta rápida não encontrada",
        });
      }

      // Verificar acesso: owners/admins veem todas, members só as próprias ou públicas
      const isOwnerOrAdmin = userRole === "owner" || userRole === "admin";
      const isOwn = result.createdBy === userId;
      const isPublic = result.visibility === "organization";

      if (!isOwnerOrAdmin && !isOwn && !isPublic) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Você não tem permissão para acessar esta resposta rápida",
        });
      }

      return selectQuickReplySchema.parse(result);
    }),

  /**
   * Create a new quick reply
   */
  create: memberProcedure
    .input(insertQuickReplySchema.omit({ organizationId: true, createdBy: true }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.session.session.activeOrganizationId;
      const userId = ctx.session.user.id;

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nenhuma organização ativa",
        });
      }

      const tenantDb = await tenantManager.getConnection(organizationId);

      // Verificar se já existe shortcut com mesmo nome na organização
      const [existing] = await tenantDb
        .select()
        .from(quickReply)
        .where(
          and(eq(quickReply.organizationId, organizationId), eq(quickReply.shortcut, input.shortcut)),
        )
        .limit(1);

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Já existe uma resposta rápida com o atalho '${input.shortcut}'`,
        });
      }

      const [newQuickReply] = await tenantDb
        .insert(quickReply)
        .values({
          ...input,
          organizationId,
          createdBy: userId,
          content: getContentPreview(input.messages),
        })
        .returning();

      return newQuickReply;
    }),

  /**
   * Update a quick reply
   * Members can only update their own, owners/admins can update all
   */
  update: memberProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: updateQuickReplySchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.session.session.activeOrganizationId;
      const userId = ctx.session.user.id;
      const userRole = ctx.agent.role;

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nenhuma organização ativa",
        });
      }

      const tenantDb = await tenantManager.getConnection(organizationId);

      // Verificar se existe
      const [existing] = await tenantDb
        .select()
        .from(quickReply)
        .where(and(eq(quickReply.id, input.id), eq(quickReply.organizationId, organizationId)))
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Resposta rápida não encontrada",
        });
      }

      // Verificar permissão: owners/admins podem editar todas, members só as próprias
      const isOwnerOrAdmin = userRole === "owner" || userRole === "admin";
      const isOwn = existing.createdBy === userId;

      if (!isOwnerOrAdmin && !isOwn) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Você não tem permissão para editar esta resposta rápida",
        });
      }

      // Se estiver mudando o shortcut, verificar se não conflita
      if (input.data.shortcut && input.data.shortcut !== existing.shortcut) {
        const [shortcutConflict] = await tenantDb
          .select()
          .from(quickReply)
          .where(
            and(
              eq(quickReply.organizationId, organizationId),
              eq(quickReply.shortcut, input.data.shortcut),
            ),
          )
          .limit(1);

        if (shortcutConflict) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Já existe uma resposta rápida com o atalho '${input.data.shortcut}'`,
          });
        }
      }

      // Opção 2: Deletar mídias removidas do R2 ao salvar
      if (input.data.messages) {
        const oldMediaUrls = new Set(
          existing.messages
            .map((m) => m.mediaUrl)
            .filter((url): url is string => !!url && url.startsWith("http"))
        );

        const newMediaUrls = new Set(
          input.data.messages
            .map((m) => m.mediaUrl)
            .filter((url): url is string => !!url && url.startsWith("http"))
        );

        // URLs que foram removidas
        const removedUrls = [...oldMediaUrls].filter((url) => !newMediaUrls.has(url));

        // Deletar do R2 em background
        for (const url of removedUrls) {
          const key = extractKeyFromUrl(url);
          if (key) {
            storage.delete(key).catch((error) => {
              console.error("Erro ao deletar mídia do R2:", error);
            });
          }
        }
      }

      // Gerar content automaticamente se messages foi atualizado
      const updateData = {
        ...input.data,
        updatedAt: new Date(),
        ...(input.data.messages && { content: getContentPreview(input.data.messages) }),
      };

      const [updated] = await tenantDb
        .update(quickReply)
        .set(updateData)
        .where(eq(quickReply.id, input.id))
        .returning();

      return updated;
    }),

  /**
   * Delete a quick reply
   * Members can only delete their own, owners/admins can delete all
   */
  delete: memberProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.session.session.activeOrganizationId;
      const userId = ctx.session.user.id;
      const userRole = ctx.agent.role;

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nenhuma organização ativa",
        });
      }

      const tenantDb = await tenantManager.getConnection(organizationId);

      // Verificar se existe
      const [existing] = await tenantDb
        .select()
        .from(quickReply)
        .where(and(eq(quickReply.id, input.id), eq(quickReply.organizationId, organizationId)))
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Resposta rápida não encontrada",
        });
      }

      // Verificar permissão
      const isOwnerOrAdmin = userRole === "owner" || userRole === "admin";
      const isOwn = existing.createdBy === userId;

      if (!isOwnerOrAdmin && !isOwn) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Você não tem permissão para deletar esta resposta rápida",
        });
      }

      // Verificar se existe agendamento pendente usando esta quick reply
      const pendingSchedules = await tenantDb
        .select()
        .from(scheduledMessage)
        .where(
          and(
            eq(scheduledMessage.organizationId, organizationId),
            eq(scheduledMessage.quickReplyId, input.id),
            eq(scheduledMessage.status, "pending")
          )
        );

      if (pendingSchedules.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Não é possível deletar esta resposta rápida pois existem ${pendingSchedules.length} agendamento(s) pendente(s) utilizando-a.`,
        });
      }

      // Deletar todas as mídias do R2 antes de deletar a quick reply
      const mediaUrls = existing.messages
        .map((m) => m.mediaUrl)
        .filter((url): url is string => !!url && url.startsWith("http"));

      for (const url of mediaUrls) {
        const key = extractKeyFromUrl(url);
        if (key) {
          storage.delete(key).catch((error) => {
            console.error("Erro ao deletar mídia do R2:", error);
          });
        }
      }

      await tenantDb.delete(quickReply).where(eq(quickReply.id, input.id));

      return { success: true };
    }),

  /**
   * Delete multiple quick replies
   * Only owners/admins can delete multiple
   */
  deleteMany: ownerProcedure
    .input(z.object({ ids: z.array(z.string().uuid()) }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.session.session.activeOrganizationId;

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nenhuma organização ativa",
        });
      }

      const tenantDb = await tenantManager.getConnection(organizationId);

      // Verificar se alguma quick reply tem agendamentos pendentes
      const pendingSchedules = await tenantDb
        .select({
          quickReplyId: scheduledMessage.quickReplyId,
          count: count(),
        })
        .from(scheduledMessage)
        .where(
          and(
            eq(scheduledMessage.organizationId, organizationId),
            inArray(scheduledMessage.quickReplyId, input.ids),
            eq(scheduledMessage.status, "pending")
          )
        )
        .groupBy(scheduledMessage.quickReplyId);

      if (pendingSchedules.length > 0 && pendingSchedules[0]) {
        const firstBlocked = pendingSchedules[0];

        if (!firstBlocked.quickReplyId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Não é possível deletar esta resposta rápida pois existem agendamentos pendentes utilizando-a.",
          });
        }

        const [qr] = await tenantDb
          .select()
          .from(quickReply)
          .where(eq(quickReply.id, firstBlocked.quickReplyId))
          .limit(1);

        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Não é possível deletar a resposta rápida "${qr?.title}" pois existem ${firstBlocked.count} agendamento(s) pendente(s) utilizando-a.`,
        });
      }

      await Promise.all(
        input.ids.map((id) =>
          tenantDb
            .delete(quickReply)
            .where(and(eq(quickReply.id, id), eq(quickReply.organizationId, organizationId))),
        ),
      );

      return { success: true };
    }),

  /**
   * Increment usage count when a quick reply is used
   */
  use: memberProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.session.session.activeOrganizationId;

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nenhuma organização ativa",
        });
      }

      const tenantDb = await tenantManager.getConnection(organizationId);

      await tenantDb
        .update(quickReply)
        .set({
          usageCount: sql`${quickReply.usageCount} + 1`,
          lastUsedAt: new Date(),
        })
        .where(and(eq(quickReply.id, input.id), eq(quickReply.organizationId, organizationId)));

      return { success: true };
    }),

  /**
   * Deletar mídia de quick reply do R2
   * Usado quando o usuário remove uma mídia do form ou ao salvar
   */
  deleteMedia: memberProcedure
    .input(
      z.object({
        publicUrl: z.string().url(),
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

      try {
        // Extrair key da URL pública
        const key = extractKeyFromUrl(input.publicUrl);

        if (!key) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "URL inválida",
          });
        }

        // Verificar se o path pertence à organização
        if (!key.startsWith(`${organizationId}/`)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Você não tem permissão para deletar este arquivo",
          });
        }

        // Deletar do R2
        await storage.delete(key);

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        console.error("Erro ao deletar mídia do R2:", error);

        // Não falhar se arquivo não existir
        return { success: true };
      }
    }),

  /**
   * Search quick replies by shortcut (for autocomplete in chat input)
   */
  search: memberProcedure
    .input(
      z.object({
        query: z.string().default(""),
        limit: z.number().min(1).max(10).default(5),
      }),
    )
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.session.session.activeOrganizationId;
      const userId = ctx.session.user.id;

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nenhuma organização ativa",
        });
      }

      const tenantDb = await tenantManager.getConnection(organizationId);

      // Adiciona "/" se não começar com / (ou usa "/" se vazio para listar todas)
      const searchQuery = input.query
        ? input.query.startsWith("/")
          ? input.query
          : `/${input.query}`
        : "/";

      const quickReplies = await tenantDb
        .select()
        .from(quickReply)
        .where(
          and(
            eq(quickReply.organizationId, organizationId),
            eq(quickReply.isActive, true),
            ilike(quickReply.shortcut, `${searchQuery}%`),
            or(
              eq(quickReply.visibility, "organization"),
              and(eq(quickReply.visibility, "private"), eq(quickReply.createdBy, userId)),
            ),
          ),
        )
        .orderBy(desc(quickReply.usageCount))
        .limit(input.limit);

      return quickReplies.map((qr) => selectQuickReplySchema.parse(qr));
    }),

  /**
   * List quick replies available for scheduling
   * Returns only active quick replies that user has access to
   */
  listAvailableForScheduling: memberProcedure.query(async ({ ctx }) => {
    const organizationId = ctx.session.session.activeOrganizationId;
    const userId = ctx.session.user.id;

    if (!organizationId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Nenhuma organização ativa",
      });
    }

    const tenantDb = await tenantManager.getConnection(organizationId);

    const quickReplies = await tenantDb
      .select()
      .from(quickReply)
      .where(
        and(
          eq(quickReply.organizationId, organizationId),
          eq(quickReply.isActive, true),
          or(
            eq(quickReply.visibility, "organization"),
            and(eq(quickReply.visibility, "private"), eq(quickReply.createdBy, userId)),
          ),
        ),
      )
      .orderBy(desc(quickReply.usageCount), desc(quickReply.createdAt));

    return quickReplies.map((qr) => selectQuickReplySchema.parse(qr));
  }),

  /**
   * Send quick reply messages
   * Processa e envia todas as mensagens de uma quick reply (texto + mídia)
   */
  send: memberProcedure
    .input(
      z.object({
        quickReplyId: z.string().uuid(),
        chatId: z.string().uuid(),
        variables: z.object({
          contactName: z.string(),
          agentName: z.string(),
          organizationName: z.string(),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.session.session.activeOrganizationId;
      const userId = ctx.session.user.id;

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nenhuma organização ativa",
        });
      }

      const tenantDb = await tenantManager.getConnection(organizationId);

      // Buscar quick reply
      const [quickReplyData] = await tenantDb
        .select()
        .from(quickReply)
        .where(
          and(
            eq(quickReply.id, input.quickReplyId),
            eq(quickReply.organizationId, organizationId),
            eq(quickReply.isActive, true),
            or(
              eq(quickReply.visibility, "organization"),
              and(eq(quickReply.visibility, "private"), eq(quickReply.createdBy, userId)),
            ),
          ),
        )
        .limit(1);

      if (!quickReplyData) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Resposta rápida não encontrada",
        });
      }

      // Buscar agent do usuário
      const [currentAgent] = await tenantDb
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

      const messages = quickReplyData.messages;

      // Processar variáveis em cada mensagem
      const processedMessages = messages.map((msg) => ({
        ...msg,
        content: msg.content
          .replace(/\{\{contact\.name\}\}/g, input.variables.contactName)
          .replace(/\{\{agent\.name\}\}/g, input.variables.agentName)
          .replace(/\{\{organization\.name\}\}/g, input.variables.organizationName),
      }));

      // Inicializar MessageService
      const messageService = getInternalMessageService({
        redisUrl: env.REDIS_URL,
        getTenantConnection: tenantManager.getConnection.bind(tenantManager),
        getCatalogDb: () => db,
      });

      const messageContext = {
        organizationId,
        tenantDb,
        agentId: currentAgent.id,
        agentName: input.variables.agentName,
      };

      // Enviar cada mensagem
      for (const message of processedMessages) {
        if (message.mediaUrl?.startsWith("http")) {
          // Mensagem com mídia
          const storagePath = extractKeyFromUrl(message.mediaUrl);

          if (!storagePath) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "URL de mídia inválida",
            });
          }

          // Determinar messageType
          let messageType: "image" | "video" | "audio" | "document" = "document";
          if (message.mediaMimeType?.startsWith("image/")) messageType = "image";
          else if (message.mediaMimeType?.startsWith("video/")) messageType = "video";
          else if (message.mediaMimeType?.startsWith("audio/")) messageType = "audio";

          await messageService.createTextMessage(messageContext, {
            chatId: input.chatId,
            content: message.content,
            messageType,
            agentId: currentAgent.id,
            agentName: input.variables.agentName,
            attachmentData: {
              fileName: message.mediaName ?? "file",
              mimeType: message.mediaMimeType ?? "application/octet-stream",
              mediaType: messageType,
              storagePath,
              storageUrl: message.mediaUrl,
            },
          });
        } else {
          // Mensagem de texto
          await messageService.createTextMessage(messageContext, {
            chatId: input.chatId,
            content: message.content,
            agentId: currentAgent.id,
            agentName: input.variables.agentName,
          });
        }

        // Delay entre mensagens
        await new Promise((resolve) => setTimeout(resolve, 150));
      }

      // Incrementar contador de uso
      await tenantDb
        .update(quickReply)
        .set({
          usageCount: sql`${quickReply.usageCount} + 1`,
          lastUsedAt: new Date(),
        })
        .where(eq(quickReply.id, input.quickReplyId));

      return { success: true, messageCount: messages.length };
    }),

  /**
   * Trigger orphan cleanup job for quick reply media
   * Enfileira job para limpar arquivos órfãos de quick replies no R2
   */
  triggerOrphanCleanup: ownerProcedure
    .input(
      z.object({
        dryRun: z.boolean().default(false),
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

      // Enfileirar job no BullMQ
      const connection = getRedisClient(env.REDIS_URL);
      const queue = createQueue({
        name: "quick-reply-orphan-cleanup",
        connection,
      });

      const job = await queue.add("quick-reply-orphan-cleanup", {
        organizationId,
        dryRun: input.dryRun,
      });

      return {
        success: true,
        jobId: job.id,
        dryRun: input.dryRun,
      };
    }),
});
