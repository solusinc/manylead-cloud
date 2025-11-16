import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  and,
  db as catalogDb,
  channel,
  CHANNEL_STATUS,
  CHANNEL_TYPE,
  eq,
  insertChannelSchema,
  organization,
  selectChannelSchema,
  updateChannelSchema,
} from "@manylead/db";
import { EvolutionAPIClient } from "@manylead/evolution-api-client";

import { env } from "../env";
import { createTRPCRouter, ownerProcedure, tenantManager } from "../trpc";

// Helper para criar Evolution API Client com env vars do runtime
function getEvolutionClient() {
  const apiUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;

  if (!apiUrl || !apiKey) {
    throw new Error(
      "EVOLUTION_API_URL and EVOLUTION_API_KEY must be set in environment variables",
    );
  }

  return new EvolutionAPIClient(apiUrl, apiKey);
}

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
   * Get channel by type (qr_code or official)
   */
  getByType: ownerProcedure
    .input(z.object({ channelType: z.enum(["qr_code", "official"]) }))
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.session.session.activeOrganizationId;

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nenhuma organização ativa",
        });
      }

      const [ch] = await ctx.tenantDb
        .select()
        .from(channel)
        .where(
          and(
            eq(channel.organizationId, organizationId),
            eq(channel.channelType, input.channelType),
          ),
        )
        .limit(1);

      return ch ? selectChannelSchema.parse(ch) : null;
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
            eq(channel.channelType, input.channelType),
          ),
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
      const evolutionInstanceName = org.slug;

      // Criar instância na Evolution API (somente para QR Code)
      if (input.channelType === CHANNEL_TYPE.QR_CODE) {
        const evolutionClient = getEvolutionClient();
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

      const tenantDb = await tenantManager.getConnection(organizationId);

      // Verificar existência
      const [existing] = await tenantDb
        .select()
        .from(channel)
        .where(
          and(
            eq(channel.id, input.id),
            eq(channel.organizationId, organizationId),
          ),
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
        const evolutionClient = getEvolutionClient();
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
            eq(channel.organizationId, organizationId),
          ),
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
        const evolutionClient = getEvolutionClient();
        await evolutionClient.instance.delete(ch.evolutionInstanceName);
      }

      // Deletar do DB
      await tenantDb
        .delete(channel)
        .where(
          and(
            eq(channel.id, input.id),
            eq(channel.organizationId, organizationId),
          ),
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

      // Se já estiver conectado, não precisa gerar QR Code
      if (ch.status === CHANNEL_STATUS.CONNECTED) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Canal já está conectado",
        });
      }

      const evolutionClient = getEvolutionClient();

      // Verificar se a instância existe, se não existir, criar
      try {
        await evolutionClient.instance.fetch(ch.evolutionInstanceName);
      } catch {
        // Instância não existe, criar nova
        await evolutionClient.instance.create({
          instanceName: ch.evolutionInstanceName,
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
   * Connect via Pairing Code (phone number)
   */
  connectPairingCode: ownerProcedure
    .input(
      z.object({
        id: z.uuid(),
        phoneNumber: z.string().min(10, "Número inválido"),
      }),
    )
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

      if (!ch.evolutionInstanceName) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Canal não possui instância Evolution",
        });
      }

      const evolutionClient = getEvolutionClient();

      // Para pairing code funcionar, a instância DEVE ser criada com o campo "number"
      // Se já existe uma instância (do QR Code), precisamos fazer logout e deletar antes
      try {
        await evolutionClient.instance.fetch(ch.evolutionInstanceName);

        // Fazer logout primeiro (necessário para poder deletar)
        try {
          await evolutionClient.instance.logout(ch.evolutionInstanceName);
        } catch {
          // Ignorar erro de logout (instance pode não estar conectada)
        }

        // Aguardar um pouco para garantir que logout foi processado
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Deletar instância
        await evolutionClient.instance.delete(ch.evolutionInstanceName);

        // Aguardar um pouco antes de recriar
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch {
        // Instance não existe, continua normalmente
      }

      // Criar instância COM O NÚMERO para ativar pairing code
      await evolutionClient.instance.create({
        instanceName: ch.evolutionInstanceName,
        number: input.phoneNumber, // IMPORTANTE: número é necessário para pairing code
        qrcode: false, // Desabilitar QR code quando usar pairing code
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

      // Solicitar código de emparelhamento via Evolution API
      // Usa GET /instance/connect/{instanceName}?number=phoneNumber
      const pairingResponse = await evolutionClient.instance.requestCode(
        ch.evolutionInstanceName,
        input.phoneNumber,
      );

      // A Evolution retorna { pairingCode: "WZYEH1YY", code: "2@...", count: 1 }
      const pairingCode = pairingResponse.pairingCode;

      if (!pairingCode) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "Erro ao gerar código de emparelhamento. Verifique o número de telefone.",
        });
      }

      // Validar formato (deve ter 8 caracteres)
      if (pairingCode.length !== 8) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Código de emparelhamento inválido. Tente novamente.",
        });
      }

      return {
        pairingCode,
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

      // Verificar se canal existe e está conectado
      const [ch] = await ctx.tenantDb
        .select()
        .from(channel)
        .where(
          and(
            eq(channel.id, input.channelId),
            eq(channel.organizationId, organizationId),
          ),
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
      const evolutionClient = getEvolutionClient();
      await evolutionClient.message.sendText(ch.evolutionInstanceName, {
        number: input.to,
        text: input.text,
      });

      return { success: true };
    }),
});
