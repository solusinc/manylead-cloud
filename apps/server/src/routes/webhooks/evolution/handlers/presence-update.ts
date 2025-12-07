import { chat, contact, eq } from "@manylead/db";

import type { PresenceUpdateData } from "../types";
import { findChannelByInstanceName, WebhookLogger } from "../utils";
import { getSocketManager } from "../../../../socket";
import { tenantManager } from "~/libs/tenant-manager";

/**
 * Handle presence.update webhook from Evolution API
 * Processes typing and recording indicators from WhatsApp contacts
 */
export async function handlePresenceUpdate(
  instanceName: string,
  data: PresenceUpdateData,
) {
  const logger = new WebhookLogger("presence.update", instanceName);

  // 1. Buscar canal
  const ch = await findChannelByInstanceName(instanceName);
  if (!ch) {
    logger.warn("Canal não encontrado", { instanceName });
    return;
  }

  // 2. Extrair número de telefone do remoteJid
  const phoneNumber = data.remoteJid.split("@")[0];
  if (!phoneNumber) {
    logger.warn("Invalid remoteJid format", { remoteJid: data.remoteJid });
    return;
  }

  try {
    // 3. Conectar ao banco do tenant
    const tenantDb = await tenantManager.getConnection(ch.organizationId);

    // 4. Buscar contato pelo número de telefone
    const [contactRecord] = await tenantDb
      .select({ id: contact.id })
      .from(contact)
      .where(eq(contact.phoneNumber, phoneNumber))
      .limit(1);

    if (!contactRecord) {
      logger.warn("Contact not found", { phoneNumber });
      return;
    }

    // 5. Buscar chat ativo com esse contato
    const [chatRecord] = await tenantDb
      .select({ id: chat.id })
      .from(chat)
      .where(eq(chat.contactId, contactRecord.id))
      .limit(1);

    if (!chatRecord) {
      logger.warn("Chat not found", { contactId: contactRecord.id });
      return;
    }

    // 6. Emitir evento Socket.io baseado no presence
    const socketManager = getSocketManager();

    if (data.presences.includes("composing")) {
      socketManager.emitToRoom(`org:${ch.organizationId}`, "typing:start", {
        chatId: chatRecord.id,
        agentId: contactRecord.id,
      });
    } else if (data.presences.includes("recording")) {
      socketManager.emitToRoom(
        `org:${ch.organizationId}`,
        "recording:start",
        {
          chatId: chatRecord.id,
          agentId: contactRecord.id,
        },
      );
    } else if (
      data.presences.includes("paused") ||
      data.presences.length === 0
    ) {
      // Stop both typing and recording
      socketManager.emitToRoom(`org:${ch.organizationId}`, "typing:stop", {
        chatId: chatRecord.id,
      });
      socketManager.emitToRoom(`org:${ch.organizationId}`, "recording:stop", {
        chatId: chatRecord.id,
      });
    }

    logger.info("Presence update emitted", {
      chatId: chatRecord.id,
      presences: data.presences,
    });
  } catch (error) {
    logger.error("Failed to process presence update", error);
  }
}
