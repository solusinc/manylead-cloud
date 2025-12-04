import type { Context } from "hono";
import { Hono } from "hono";

import {
  handleConnectionUpdate,
  handleMessagesUpsert,
  handleMessagesUpdate,
  handleMessagesDelete,
  handleQRCodeUpdated,
  handleSendMessage,
} from "./handlers";
import type {
  ConnectionUpdateData,
  EvolutionWebhookPayload,
  MessagesUpsertData,
  MessagesUpdateData,
  MessagesDeleteData,
  QRCodeData,
  SendMessageData,
} from "./types";
import { validateEventData, validateWebhookPayload } from "./validation";
import { createLogger } from "~/libs/utils/logger";

const log = createLogger("EvolutionWebhook");

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

    log.info({ event, instance }, "Webhook received");

    // Roteamento de eventos para handlers específicos
    await routeEvent(event, instance, data);

    return c.json({ success: true }, 200);
  } catch (error) {
    log.error({ err: error }, "Error processing webhook");

    // Retornar 200 mesmo com erro para evitar retries da Evolution
    // mas logar o erro para debug
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
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

    case "messages.delete": {
      const validatedData = validateEventData<MessagesDeleteData>(event, data);
      await handleMessagesDelete(instance, validatedData);
      break;
    }

    // Eventos não implementados (por enquanto)
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
      log.info({ event }, "Event not implemented");
      break;

    default:
      log.warn({ event }, "Unknown event");
  }
}
