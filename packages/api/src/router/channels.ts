import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import {
  channel,
  CHANNEL_STATUS,
  insertChannelSchema,
  selectChannelSchema,
  updateChannelSchema,
} from "@manylead/db";

import { createTRPCRouter, ownerProcedure, tenantManager } from "../trpc";
import { getChannelSessionsQueue } from "../libs/queue";

/**
 * Channel session job data
 */
interface ChannelSessionJob {
  action: "start" | "stop" | "sendMessage";
  channelId: string;
  organizationId: string;
  message?: {
    to: string;
    text: string;
  };
}

/**
 * Channels Router
 *
 * Gerencia canais WhatsApp (QR Code via Baileys)
 */
export const channelsRouter = createTRPCRouter({
  /**
   * List all channels for the active organization
   */
  list: ownerProcedure.query(async ({ ctx }) => {
    const organizationId = ctx.session.session.activeOrganizationId;

    if (!organizationId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Nenhuma organização ativa",
      });
    }

    const tenantDb = await tenantManager.getConnection(organizationId);

    const channels = await tenantDb
      .select()
      .from(channel)
      .where(eq(channel.organizationId, organizationId))
      .orderBy(channel.createdAt);

    // Nunca retornar authState em listagem
    return channels.map((ch) => {
      const { authState: _authState, ...rest } = selectChannelSchema.parse(ch);
      return rest;
    });
  }),

  /**
   * Get channel by ID
   */
  getById: ownerProcedure
    .input(z.object({ id: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const [ch] = await ctx.tenantDb
        .select()
        .from(channel)
        .where(eq(channel.id, input.id))
        .limit(1);

      if (!ch) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Canal não encontrado",
        });
      }

      // Não retornar authState
      const { authState: _authState, ...rest } = selectChannelSchema.parse(ch);
      return rest;
    }),

  /**
   * Create a new QR Code channel
   */
  create: ownerProcedure
    .input(insertChannelSchema)
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.session.session.activeOrganizationId;

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nenhuma organização ativa",
        });
      }

      const tenantDb = await tenantManager.getConnection(organizationId);

      // Gerar phoneNumberId único para QR Code
      const phoneNumberId = `qr_${crypto.randomUUID()}`;

      // Criar canal
      const [newChannel] = await tenantDb
        .insert(channel)
        .values({
          ...input,
          organizationId,
          phoneNumberId,
          status: CHANNEL_STATUS.PENDING,
        })
        .returning();

      if (!newChannel) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Falha ao criar canal",
        });
      }

      // Enfileirar job para iniciar sessão Baileys
      await getChannelSessionsQueue().add("start-session", {
        action: "start",
        channelId: newChannel.id,
        organizationId,
      } satisfies ChannelSessionJob);

      const { authState: _authState, ...rest } = selectChannelSchema.parse(newChannel);
      return rest;
    }),

  /**
   * Update a channel
   */
  update: ownerProcedure
    .input(
      z.object({
        id: z.uuid(),
        data: updateChannelSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.session.session.activeOrganizationId;

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nenhuma organização ativa",
        });
      }

      const tenantDb = await tenantManager.getConnection(organizationId);

      // Verificar existência
      const [existing] = await tenantDb
        .select()
        .from(channel)
        .where(
          and(
            eq(channel.id, input.id),
            eq(channel.organizationId, organizationId)
          )
        )
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Canal não encontrado",
        });
      }

      // Atualizar
      const [updated] = await tenantDb
        .update(channel)
        .set({
          ...input.data,
          updatedAt: new Date(),
        })
        .where(eq(channel.id, input.id))
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Falha ao atualizar canal",
        });
      }

      const { authState: _authState, ...rest } = selectChannelSchema.parse(updated);
      return rest;
    }),

  /**
   * Disconnect channel (soft delete)
   */
  disconnect: ownerProcedure
    .input(z.object({ id: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.tenantDb
        .update(channel)
        .set({
          status: CHANNEL_STATUS.DISCONNECTED,
          isActive: false,
          updatedAt: new Date(),
        })
        .where(eq(channel.id, input.id))
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Canal não encontrado",
        });
      }

      // Enfileirar job para parar sessão Baileys
      const organizationId = ctx.session.session.activeOrganizationId;
      if (organizationId) {
        await getChannelSessionsQueue().add("stop-session", {
          action: "stop",
          channelId: updated.id,
          organizationId,
        } satisfies ChannelSessionJob);
      }

      const { authState: _authState2, ...rest2 } = selectChannelSchema.parse(updated);
      return rest2;
    }),

  /**
   * Delete channel (hard delete)
   */
  delete: ownerProcedure
    .input(z.object({ id: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.session.session.activeOrganizationId;

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nenhuma organização ativa",
        });
      }

      const tenantDb = await tenantManager.getConnection(organizationId);

      const [deleted] = await tenantDb
        .delete(channel)
        .where(
          and(
            eq(channel.id, input.id),
            eq(channel.organizationId, organizationId)
          )
        )
        .returning();

      if (!deleted) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Canal não encontrado",
        });
      }

      // Enfileirar job para parar sessão Baileys
      await getChannelSessionsQueue().add("stop-session", {
        action: "stop",
        channelId: deleted.id,
        organizationId,
      } satisfies ChannelSessionJob);

      return { success: true };
    }),

  /**
   * Get QR Code for channel
   */
  getQRCode: ownerProcedure
    .input(z.object({ id: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const [ch] = await ctx.tenantDb
        .select()
        .from(channel)
        .where(eq(channel.id, input.id))
        .limit(1);

      if (!ch) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Canal não encontrado",
        });
      }

      // Verificar expiração
      if (ch.qrCodeExpiresAt && new Date() > ch.qrCodeExpiresAt) {
        // TODO: Gerar novo QR code
        // await baileys.regenerateQR(ch.id);
        return { qrCode: null, expired: true, status: ch.status };
      }

      return {
        qrCode: ch.qrCode,
        expiresAt: ch.qrCodeExpiresAt,
        status: ch.status,
      };
    }),

  /**
   * Check connection status
   */
  checkConnection: ownerProcedure
    .input(z.object({ id: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const [ch] = await ctx.tenantDb
        .select()
        .from(channel)
        .where(eq(channel.id, input.id))
        .limit(1);

      if (!ch) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Canal não encontrado",
        });
      }

      // TODO: Verificar conexão real com Baileys
      // const isConnected = await baileys.checkConnection(ch.id);

      return {
        status: ch.status,
        lastConnectedAt: ch.lastConnectedAt,
        errorMessage: ch.errorMessage,
      };
    }),

  /**
   * Send a test message via WhatsApp
   */
  sendTestMessage: ownerProcedure
    .input(
      z.object({
        channelId: z.uuid(),
        to: z
          .string()
          .regex(/^\+?[1-9]\d{1,14}$/, "Número inválido. Use +5521984848843"),
        text: z.string().min(1, "Mensagem não pode ser vazia"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.session.session.activeOrganizationId;

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nenhuma organização ativa",
        });
      }

      // Verificar se canal existe e está conectado
      const [ch] = await ctx.tenantDb
        .select()
        .from(channel)
        .where(
          and(
            eq(channel.id, input.channelId),
            eq(channel.organizationId, organizationId)
          )
        )
        .limit(1);

      if (!ch) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Canal não encontrado",
        });
      }

      if (ch.status !== CHANNEL_STATUS.CONNECTED) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Canal não está conectado. Conecte o canal primeiro.",
        });
      }

      // Enfileirar job para enviar mensagem
      await getChannelSessionsQueue().add("send-message", {
        action: "sendMessage",
        channelId: input.channelId,
        organizationId,
        message: {
          to: input.to,
          text: input.text,
        },
      } satisfies ChannelSessionJob);

      return { success: true };
    }),
});
