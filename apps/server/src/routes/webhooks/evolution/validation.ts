import { z } from "zod";

/**
 * Schema de validação para webhooks da Evolution API
 */

export const evolutionWebhookSchema = z.object({
  event: z.string(),
  instance: z.string(),
  data: z.unknown(),
  destination: z.string().optional(),
  date_time: z.string(),
  sender: z.string().optional(),
  server_url: z.string(),
  apikey: z.string().nullable(),
});

export const qrcodeDataSchema = z.object({
  qrcode: z.object({
    code: z.string(),
    base64: z.string(),
  }),
});

export const connectionUpdateDataSchema = z.object({
  state: z.enum(["open", "close", "connecting"]),
  statusReason: z.union([z.string(), z.number()]).optional(),
  instance: z.string(),
  wuid: z.string().optional(),
  profileName: z.string().optional(),
  profilePictureUrl: z.string().nullable().optional(),
});

export const messageDataSchema = z
  .object({
    key: z
      .object({
        remoteJid: z.string(),
        remoteJidAlt: z.string().optional(), // Novo formato LID do WhatsApp
        fromMe: z.boolean(),
        id: z.string(),
        participant: z.string().optional(),
        addressingMode: z.string().optional(),
      })
      .passthrough(), // Preserva campos extras
    pushName: z.string().optional(),
    message: z.record(z.unknown()).optional(),
    messageType: z.string().optional(),
    messageTimestamp: z.union([z.string(), z.number()]),
    instanceId: z.string().optional(),
    source: z.string().optional(),
    status: z.string().optional(),
    contextInfo: z.record(z.unknown()).nullish(),
  })
  .passthrough(); // Preserva campos extras no root também

// Evolution API envia a mensagem diretamente, não em array
export const messagesUpsertDataSchema = messageDataSchema;

export const sendMessageDataSchema = z.object({
  key: z.object({
    remoteJid: z.string(),
    fromMe: z.boolean(),
    id: z.string(),
  }),
  message: z.record(z.unknown()),
  messageTimestamp: z.union([z.string(), z.number()]),
  status: z.string().optional(),
});

export const presenceUpdateDataSchema = z.object({
  remoteJid: z.string(),
  presences: z.array(z.string()),
  participant: z.string().optional(),
});

/**
 * Valida payload do webhook
 */
export function validateWebhookPayload(payload: unknown) {
  return evolutionWebhookSchema.parse(payload);
}

/**
 * Valida dados específicos de cada evento
 */
export function validateEventData<T>(
  event: string,
  data: unknown,
): T {
  switch (event) {
    case "qrcode.updated":
      return qrcodeDataSchema.parse(data) as T;

    case "connection.update":
      return connectionUpdateDataSchema.parse(data) as T;

    case "messages.upsert":
      return messagesUpsertDataSchema.parse(data) as T;

    case "send.message":
      return sendMessageDataSchema.parse(data) as T;

    // presence.update desabilitado temporariamente - não validar
    case "presence.update":
    default:
      // Eventos não validados retornam data as-is
      return data as T;
  }
}
