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
import {
  allocateIp,
  releaseIp,
  buildEvolutionProxyConfig,
} from "@manylead/bright-data";
import { createLogger } from "@manylead/clients/logger";

import { env } from "../env";
import { createTRPCRouter, memberProcedure, ownerProcedure, tenantManager } from "../trpc";

const logger = createLogger({ component: "ChannelRouter" });

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
  list: memberProcedure.query(async ({ ctx }) => {
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

      // Buscar slug e id da organização
      const [org] = await catalogDb
        .select({
          slug: organization.slug,
          id: organization.id
        })
        .from(organization)
        .where(eq(organization.id, organizationId))
        .limit(1);

      if (!org) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Organização não encontrada",
        });
      }

      // Gerar phoneNumberId e instanceName únicos usando slug_id da org
      const phoneNumberId = `${input.channelType}_${crypto.randomUUID()}`;
      const evolutionInstanceName = `${org.slug}_${org.id}`;

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
        // Deletar da Evolution API primeiro (se for QR Code)
        if (input.channelType === CHANNEL_TYPE.QR_CODE) {
          const evolutionClient = getEvolutionClient();

          // Deletar instância existente (se houver)
          try {
            // Fazer logout primeiro
            try {
              await evolutionClient.instance.logout(evolutionInstanceName);
            } catch {
              // Ignorar erro de logout
            }

            // Deletar instância
            await evolutionClient.instance.delete(evolutionInstanceName);
          } catch {
            // Instância não existe na Evolution (ok, continuando)
          }
        }

        // Deletar todos os canais existentes do tipo
        for (const existingChannel of existingChannels) {
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

          // CLEANUP: Verificar se existe instância com este nome
          // (caso tenha sido criada antes mas o canal foi deletado)
          try {
            await evolutionClient.instance.fetch(evolutionInstanceName);

            // Se chegou aqui, instância existe - deletar ela
            try {
              await evolutionClient.instance.logout(evolutionInstanceName);
            } catch {
              // Ignorar erro de logout
            }

            await evolutionClient.instance.delete(evolutionInstanceName);
          } catch {
            // Instância não existe, continuar normalmente
          }

          // Buscar orgSettings ANTES de criar instância para incluir proxy
          const [orgSettings] = await tenantDb
            .select()
            .from(organizationSettings)
            .where(eq(organizationSettings.organizationId, organizationId))
            .limit(1);

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

          // ISP Proxy: Verificar se precisa de IP e configurar proxy
          const proxyType = orgSettings?.proxySettings?.proxyType ?? "isp";
          const proxyEnabled = orgSettings?.proxySettings?.enabled ?? false;

          if (proxyEnabled && proxyType === "isp" && orgSettings?.proxySettings) {
            const currentProxySettings = orgSettings.proxySettings;
            const country = currentProxySettings.country ?? "br";
            const timezone = orgSettings.timezone;

            try {
              // Allocate dedicated IP for this organization
              // Automatically adds IP to pool if needed via Bright Data API
              const allocation = await allocateIp(organizationId, country);

              logger.info(
                {
                  organizationId,
                  ipIndex: allocation.ipIndex,
                  sessionId: allocation.sessionId,
                  isNew: allocation.isNew,
                },
                "IP allocated for channel"
              );

              // Build proxy config with allocated session ID
              const proxyConfig = await buildEvolutionProxyConfig(
                organizationId,
                { ...currentProxySettings, enabled: true, sessionId: allocation.sessionId },
                timezone,
              );

              // Add proxy fields to instance creation payload
              if (proxyConfig.enabled && proxyConfig.host) {
                createPayload.proxyHost = proxyConfig.host;
                createPayload.proxyPort = proxyConfig.port;
                createPayload.proxyProtocol = proxyConfig.protocol;
                createPayload.proxyUsername = proxyConfig.username;
                createPayload.proxyPassword = proxyConfig.password;

                // Update sessionId in organization settings
                await tenantDb
                  .update(organizationSettings)
                  .set({
                    proxySettings: {
                      ...currentProxySettings,
                      enabled: true,
                      sessionId: allocation.sessionId,
                    },
                    updatedAt: new Date(),
                  })
                  .where(eq(organizationSettings.organizationId, organizationId));

                logger.info(
                  {
                    organizationId,
                    instanceName: evolutionInstanceName,
                  },
                  "Proxy configured for channel"
                );
              }
            } catch (error) {
              logger.error(
                {
                  organizationId,
                  country,
                  error: error instanceof Error ? error.message : String(error),
                  stack: error instanceof Error ? error.stack : undefined,
                },
                "Failed to allocate IP for proxy"
              );

              throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "Não foi possível conectar seu canal neste momento. Entre em contato com o suporte.",
                cause: error,
              });
            }
          }

          await evolutionClient.instance.create(createPayload);
        } catch (error) {
          // Se falhar ao criar instância na Evolution, deletar o channel (rollback)
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

      // Release IP allocation for this organization
      try {
        await releaseIp(organizationId);
        logger.info(
          { organizationId, channelId: ch.id },
          "IP released for deleted channel"
        );
      } catch (error) {
        logger.warn(
          {
            organizationId,
            channelId: ch.id,
            error: error instanceof Error ? error.message : String(error),
          },
          "Failed to release IP allocation"
        );
        // Continue with deletion even if IP release fails
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
