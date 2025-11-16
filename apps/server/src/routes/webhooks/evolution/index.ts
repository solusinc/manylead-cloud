import type { Context } from "hono";
import { Hono } from "hono";

import {
  handleConnectionUpdate,
  handleMessagesUpsert,
  handleMessagesUpdate,
  handleQRCodeUpdated,
  handleSendMessage,
} from "./handlers";
import type {
  ConnectionUpdateData,
  EvolutionWebhookPayload,
  MessagesUpsertData,
  MessagesUpdateData,
  QRCodeData,
  SendMessageData,
} from "./types";
import { validateEventData, validateWebhookPayload } from "./validation";

export const evolutionWebhook = new Hono();

/**
 * POST /webhooks/evolution
 *
 * Endpoint que recebe webhooks da Evolution API
 */
evolutionWebhook.post("/", async (c: Context) => {
  try {
    // Parse e validar payload
    const rawPayload: unknown = await c.req.json();
    const payload = validateWebhookPayload(rawPayload) as EvolutionWebhookPayload;

    const { event, instance, data } = payload;

    console.log(`[Evolution Webhook] ${event} from ${instance}`);

    // Roteamento de eventos para handlers específicos
    await routeEvent(event, instance, data);

    return c.json({ success: true }, 200);
  } catch (error) {
    console.error("[Evolution Webhook] Erro ao processar:", error);

    // Retornar 200 mesmo com erro para evitar retries da Evolution
    // mas logar o erro para debug
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      },
      200,
    );
  }
});

/**
 * Roteia evento para o handler correto
 */
async function routeEvent(event: string, instance: string, data: unknown) {
  switch (event) {
    case "qrcode.updated": {
      const validatedData = validateEventData<QRCodeData>(event, data);
      await handleQRCodeUpdated(instance, validatedData);
      break;
    }

    case "connection.update": {
      const validatedData = validateEventData<ConnectionUpdateData>(event, data);
      await handleConnectionUpdate(instance, validatedData);
      break;
    }

    case "messages.upsert": {
      const validatedData = validateEventData<MessagesUpsertData>(event, data);
      await handleMessagesUpsert(instance, validatedData);
      break;
    }

    case "send.message": {
      const validatedData = validateEventData<SendMessageData>(event, data);
      await handleSendMessage(instance, validatedData);
      break;
    }

    case "messages.update": {
      const validatedData = validateEventData<MessagesUpdateData>(event, data);
      await handleMessagesUpdate(instance, validatedData);
      break;
    }

    // Eventos não implementados (por enquanto)
    case "messages.delete":
    case "contacts.upsert":
    case "contacts.update":
    case "presence.update":
    case "chats.upsert":
    case "chats.update":
    case "chats.delete":
    case "groups.upsert":
    case "groups.update":
    case "group-participants.update":
    case "labels.edit":
    case "labels.association":
      console.log(`[Evolution Webhook] Evento não implementado: ${event}`);
      break;

    default:
      console.warn(`[Evolution Webhook] Evento desconhecido: ${event}`);
  }
}
