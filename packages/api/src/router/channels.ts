import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import {
  channel,
  CHANNEL_STATUS,
  CHANNEL_TYPE,
  insertChannelSchema,
  selectChannelSchema,
  updateChannelSchema,
  db as catalogDb,
  organization,
} from "@manylead/db";
import { EvolutionAPIClient } from "@manylead/evolution-api-client";

import { createTRPCRouter, ownerProcedure, tenantManager } from "../trpc";
import { env } from "../env";

// Instância do Evolution API Client
const evolutionClient = new EvolutionAPIClient();

/**
 * Channels Router
 *
 * Gerencia canais WhatsApp via Evolution API
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

    return channels.map((ch) => selectChannelSchema.parse(ch));
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

      return selectChannelSchema.parse(ch);
    }),

  /**
   * Create a new QR Code channel using Evolution API
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

      // Buscar slug da organização
      const [org] = await catalogDb
        .select({ slug: organization.slug })
        .from(organization)
        .where(eq(organization.id, organizationId))
        .limit(1);

      if (!org) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Organização não encontrada",
        });
      }

      // Verificar se já existe canal deste tipo para a organização
      const existingChannel = await tenantDb
        .select()
        .from(channel)
        .where(
          and(
            eq(channel.organizationId, organizationId),
            eq(channel.channelType, input.channelType)
          )
        )
        .limit(1);

      if (existingChannel.length > 0) {
        const typeLabel =
          input.channelType === CHANNEL_TYPE.QR_CODE ? "QR Code" : "Oficial";
        throw new TRPCError({
          code: "CONFLICT",
          message: `Você já possui um canal ${typeLabel}. Cada organização pode ter no máximo 1 canal de cada tipo.`,
        });
      }

      // Gerar phoneNumberId e instanceName únicos usando slug da org
      const phoneNumberId = `${input.channelType}_${crypto.randomUUID()}`;
      const evolutionInstanceName = `manylead_${org.slug}`;

      // Criar instância na Evolution API (somente para QR Code)
      if (input.channelType === CHANNEL_TYPE.QR_CODE) {
        await evolutionClient.instance.create({
          instanceName: evolutionInstanceName,
          qrcode: true,
          integration: "WHATSAPP-BAILEYS",
          webhook: {
            url: `${env.WEBHOOK_BASE_URL}/webhooks/evolution`,
            enabled: true,
            webhookByEvents: true,
            events: [
              "QRCODE_UPDATED",
              "CONNECTION_UPDATE",
              "MESSAGES_UPSERT",
              "SEND_MESSAGE",
            ],
          },
        });
      }

      // Criar canal no DB
      const [newChannel] = await tenantDb
        .insert(channel)
        .values({
          ...input,
          organizationId,
          phoneNumberId,
          evolutionInstanceName,
          evolutionConnectionState:
            input.channelType === CHANNEL_TYPE.QR_CODE ? "close" : null,
          status: CHANNEL_STATUS.PENDING,
        })
        .returning();

      if (!newChannel) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Falha ao criar canal",
        });
      }

      return selectChannelSchema.parse(newChannel);
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

      return selectChannelSchema.parse(updated);
    }),

  /**
   * Disconnect channel (soft delete) using Evolution API
   */
  disconnect: ownerProcedure
    .input(z.object({ id: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
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

      // Fazer logout na Evolution API
      if (ch.evolutionInstanceName) {
        await evolutionClient.instance.logout(ch.evolutionInstanceName);
      }

      // Atualizar status no DB
      const [updated] = await ctx.tenantDb
        .update(channel)
        .set({
          status: CHANNEL_STATUS.DISCONNECTED,
          isActive: false,
          evolutionConnectionState: "close",
          updatedAt: new Date(),
        })
        .where(eq(channel.id, input.id))
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Falha ao desconectar canal",
        });
      }

      return selectChannelSchema.parse(updated);
    }),

  /**
   * Delete channel (hard delete) using Evolution API
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

      // Buscar canal antes de deletar para pegar evolutionInstanceName
      const [ch] = await tenantDb
        .select()
        .from(channel)
        .where(
          and(
            eq(channel.id, input.id),
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

      // Deletar instância da Evolution API
      if (ch.evolutionInstanceName) {
        await evolutionClient.instance.delete(ch.evolutionInstanceName);
      }

      // Deletar do DB
      await tenantDb
        .delete(channel)
        .where(
          and(
            eq(channel.id, input.id),
            eq(channel.organizationId, organizationId)
          )
        );

      return { success: true };
    }),

  /**
   * Get QR Code for channel from Evolution API
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

      if (!ch.evolutionInstanceName) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Canal não possui instância Evolution",
        });
      }

      // Buscar QR code da Evolution API
      const qrCodeResponse = await evolutionClient.instance.connect(
        ch.evolutionInstanceName,
      );

      return {
        qrCode: qrCodeResponse.base64,
        status: ch.status,
        connectionState: ch.evolutionConnectionState,
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
   * Send a test message via Evolution API
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

      if (!ch.evolutionInstanceName) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Canal não possui instância Evolution",
        });
      }

      // Enviar mensagem via Evolution API
      await evolutionClient.message.sendText(ch.evolutionInstanceName, {
        number: input.to,
        text: input.text,
      });

      return { success: true };
    }),
});
