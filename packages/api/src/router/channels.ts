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
  organizationSettings,
  selectChannelSchema,
  updateChannelSchema,
} from "@manylead/db";
import type { CreateInstanceRequest } from "@manylead/evolution-api-client";
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
   * Check if organization has at least one connected channel
   */
  hasConnectedChannel: ownerProcedure.query(async ({ ctx }) => {
    const organizationId = ctx.session.session.activeOrganizationId;

    if (!organizationId) {
      return false;
    }

    const tenantDb = await tenantManager.getConnection(organizationId);

    const [connectedChannel] = await tenantDb
      .select()
      .from(channel)
      .where(
        and(
          eq(channel.organizationId, organizationId),
          eq(channel.status, "connected"),
          eq(channel.isActive, true),
        ),
      )
      .limit(1);

    return !!connectedChannel;
  }),

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

      // Gerar phoneNumberId e instanceName únicos usando slug da org
      const phoneNumberId = `${input.channelType}_${crypto.randomUUID()}`;
      const evolutionInstanceName = org.slug;

      // SEMPRE deletar canal existente (se houver) antes de criar novo
      const existingChannels = await tenantDb
        .select()
        .from(channel)
        .where(
          and(
            eq(channel.organizationId, organizationId),
            eq(channel.channelType, input.channelType),
          ),
        );

      if (existingChannels.length > 0) {
        console.log("DEBUG: Canal existente encontrado, deletando...");

        // Deletar da Evolution API primeiro (se for QR Code)
        if (input.channelType === CHANNEL_TYPE.QR_CODE) {
          const evolutionClient = getEvolutionClient();

          // Verificar se instância existe antes de tentar deletar
          try {
            const existingInstance = await evolutionClient.instance.fetch(evolutionInstanceName);
            console.log("DEBUG: Instância existe na Evolution, deletando:", existingInstance);

            // Fazer logout primeiro
            try {
              await evolutionClient.instance.logout(evolutionInstanceName);
              console.log("DEBUG: Logout realizado");
            } catch (logoutError) {
              console.log("DEBUG: Erro no logout (ignorando):", logoutError);
            }

            // Deletar instância
            await evolutionClient.instance.delete(evolutionInstanceName);
            console.log("DEBUG: Instância deletada da Evolution");
          } catch {
            console.log("DEBUG: Instância não existe na Evolution (ok, continuando)");
          }
        }

        // Deletar todos os canais existentes do tipo
        for (const existingChannel of existingChannels) {
          console.log("DEBUG: Deletando canal do banco:", existingChannel.id);
          await tenantDb.delete(channel).where(eq(channel.id, existingChannel.id));
        }
      }

      // Criar canal no DB PRIMEIRO (antes da Evolution API para webhook encontrar)
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

      // Criar instância na Evolution API (somente para QR Code)
      if (input.channelType === CHANNEL_TYPE.QR_CODE) {
        try {
          const evolutionClient = getEvolutionClient();

          // Buscar orgSettings ANTES de criar instância para incluir proxy
          console.log("DEBUG: Buscando orgSettings para organizationId:", organizationId);
          const [orgSettings] = await tenantDb
            .select()
            .from(organizationSettings)
            .where(eq(organizationSettings.organizationId, organizationId))
            .limit(1);

          console.log("DEBUG: orgSettings encontrado:", orgSettings);
          console.log("DEBUG: proxySettings:", orgSettings?.proxySettings);
          console.log("DEBUG: proxySettings.enabled:", orgSettings?.proxySettings?.enabled);

          // Criar instância com proxy direto (SEM campo "enabled")
          console.log("DEBUG: Criando instância:", evolutionInstanceName);

          const createPayload: CreateInstanceRequest = {
            instanceName: evolutionInstanceName,
            qrcode: true,
            integration: "WHATSAPP-BAILEYS",
            alwaysOnline: true,
            webhook: {
              url: `${env.WEBHOOK_BASE_URL}/webhooks/evolution`,
              enabled: true,
              webhookByEvents: true,
              events: [
                "QRCODE_UPDATED",
                "CONNECTION_UPDATE",
                "MESSAGES_UPSERT",
                "MESSAGES_UPDATE",
                "MESSAGES_DELETE",
                "SEND_MESSAGE",
                "PRESENCE_UPDATE",
                "GROUPS_UPSERT",
                "GROUP_UPDATE",
                "GROUP_PARTICIPANTS_UPDATE",
              ],
            },
          };

          // TODO: Habilitar quando Bright Data aprovar KYC
          // // Adicionar campos de proxy se habilitado (SEM o campo "enabled"!)
          // if (orgSettings?.proxySettings?.enabled) {
          //   const brightData = getBrightDataClient();
          //   const proxyConfig = brightData.getProxyConfig(
          //     organizationId,
          //     orgSettings.proxySettings,
          //     orgSettings.timezone,
          //   );

          //   // Adicionar campos de proxy (SEM enabled)
          //   createPayload.proxyHost = proxyConfig.host;
          //   createPayload.proxyPort = proxyConfig.port;
          //   createPayload.proxyProtocol = proxyConfig.protocol;
          //   createPayload.proxyUsername = proxyConfig.username;
          //   createPayload.proxyPassword = proxyConfig.password;

          //   console.log("=== CREATE WITH PROXY ===");
          //   console.log(JSON.stringify(createPayload, null, 2));
          //   console.log("=========================");

          //   // Atualizar sessionId no DB
          //   await tenantDb
          //     .update(organizationSettings)
          //     .set({
          //       proxySettings: {
          //         enabled: true,
          //         country: orgSettings.proxySettings.country,
          //         sessionId: proxyConfig.username?.split("session-")[1]?.split("-country-")[0],
          //         lastKeepAliveAt: new Date().toISOString(),
          //         rotationCount: orgSettings.proxySettings.rotationCount,
          //         lastRotatedAt: orgSettings.proxySettings.lastRotatedAt,
          //       },
          //       updatedAt: new Date(),
          //     })
          //     .where(eq(organizationSettings.organizationId, organizationId));
          // }

          await evolutionClient.instance.create(createPayload);
          console.log("DEBUG: Instância criada com sucesso");
        } catch (error) {
          // Se falhar ao criar instância na Evolution, deletar o channel (rollback)
          console.log("ERROR: Falha ao criar instância, fazendo rollback do channel");
          await tenantDb.delete(channel).where(eq(channel.id, newChannel.id));
          throw error;
        }
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

        // Fazer logout primeiro para limpar conexões
        try {
          await evolutionClient.instance.logout(ch.evolutionInstanceName);
        } catch {
          // Ignorar erro de logout
        }

        // Deletar instância
        try {
          await evolutionClient.instance.delete(ch.evolutionInstanceName);
        } catch {
          // Ignorar erro de delete
        }
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
          alwaysOnline: true,
          webhook: {
            url: `${env.WEBHOOK_BASE_URL}/webhooks/evolution`,
            enabled: true,
            webhookByEvents: true,
            events: [
              "QRCODE_UPDATED",
              "CONNECTION_UPDATE",
              "MESSAGES_UPSERT",
              "MESSAGES_UPDATE",
              "MESSAGES_DELETE",
              "SEND_MESSAGE",
              "PRESENCE_UPDATE",
              "GROUPS_UPSERT",
              "GROUP_UPDATE",
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
        alwaysOnline: true,
        webhook: {
          url: `${env.WEBHOOK_BASE_URL}/webhooks/evolution`,
          enabled: true,
          webhookByEvents: true,
          events: [
            "QRCODE_UPDATED",
            "CONNECTION_UPDATE",
            "MESSAGES_UPSERT",
            "MESSAGES_UPDATE",
            "MESSAGES_DELETE",
            "SEND_MESSAGE",
            "PRESENCE_UPDATE",
            "GROUPS_UPSERT",
            "GROUP_UPDATE",
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
