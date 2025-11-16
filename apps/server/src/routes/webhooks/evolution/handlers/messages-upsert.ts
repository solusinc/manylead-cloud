import { and, attachment, chat, contact, eq, message } from "@manylead/db";
import { createMediaDownloadQueue } from "@manylead/shared/queue";

import { getSocketManager } from "~/socket";
import { tenantManager } from "~/libs/tenant-manager";

import type { MessagesUpsertData } from "../types";
import { findChannelByInstanceName, WebhookLogger } from "../utils";

/**
 * Handler: Messages Upsert
 *
 * Processa mensagens recebidas do WhatsApp:
 * - Criar/atualizar contato
 * - Criar/atualizar chat
 * - Salvar mensagem no DB
 * - Enfileirar download de mídia se necessário
 */
export async function handleMessagesUpsert(
  instanceName: string,
  data: MessagesUpsertData,
) {
  const logger = new WebhookLogger("messages.upsert", instanceName);

  // Buscar canal
  const ch = await findChannelByInstanceName(instanceName);
  if (!ch) {
    logger.warn("Canal não encontrado");
    return;
  }

  logger.info(`${data.messages.length} mensagens recebidas`);

  const tenantDb = await tenantManager.getConnection(ch.organizationId);
  const socketManager = getSocketManager();

  for (const msg of data.messages) {
    // Ignorar mensagens enviadas por nós
    if (msg.key.fromMe) {
      logger.info("Ignorando mensagem enviada por nós", { id: msg.key.id });
      continue;
    }

    logger.info("Processando mensagem", {
      from: msg.key.remoteJid,
      id: msg.key.id,
      type: msg.messageType,
    });

    try {
      // Extrair phoneNumber do remoteJid (formato: 5511999999999@s.whatsapp.net)
      const phoneNumber = msg.key.remoteJid.split("@")[0];
      if (!phoneNumber) {
        logger.warn("Número de telefone inválido", { remoteJid: msg.key.remoteJid });
        continue;
      }

      // 1. Buscar ou criar contato
      let contactRecord = await tenantDb
        .select()
        .from(contact)
        .where(eq(contact.phoneNumber, phoneNumber))
        .limit(1)
        .then((rows) => rows[0] ?? null);

      if (!contactRecord) {
        logger.info("Criando novo contato", { phoneNumber });

        const [newContact] = await tenantDb
          .insert(contact)
          .values({
            organizationId: ch.organizationId,
            phoneNumber,
            name: msg.pushName ?? phoneNumber,
            metadata: {
              source: "whatsapp" as const,
              firstMessageAt: new Date(),
              whatsappProfileName: msg.pushName,
            },
          })
          .returning();

        if (!newContact) {
          logger.error("Falha ao criar contato");
          continue;
        }

        contactRecord = newContact;
      } else {
        // Atualizar nome se diferente
        if (msg.pushName && msg.pushName !== contactRecord.name) {
          await tenantDb
            .update(contact)
            .set({
              name: msg.pushName,
              updatedAt: new Date(),
            })
            .where(eq(contact.id, contactRecord.id));
        }
      }

      // 2. Buscar ou criar chat
      let chatRecord = await tenantDb
        .select()
        .from(chat)
        .where(
          and(
            eq(chat.contactId, contactRecord.id),
            eq(chat.channelId, ch.id),
            eq(chat.messageSource, "whatsapp"),
          ),
        )
        .orderBy(chat.createdAt)
        .limit(1)
        .then((rows) => rows[0] ?? null);

      if (!chatRecord) {
        logger.info("Criando novo chat", { contactId: contactRecord.id });

        const [newChat] = await tenantDb
          .insert(chat)
          .values({
            organizationId: ch.organizationId,
            contactId: contactRecord.id,
            channelId: ch.id,
            messageSource: "whatsapp",
            status: "open",
            initiatorInstanceCode: instanceName,
          })
          .returning();

        if (!newChat) {
          logger.error("Falha ao criar chat");
          continue;
        }

        chatRecord = newChat;

        // TODO: Aplicar auto-assignment (próxima fase)
      }

      // 3. Verificar se mensagem já existe (evitar duplicatas)
      const existingMessage = await tenantDb
        .select()
        .from(message)
        .where(eq(message.whatsappMessageId, msg.key.id))
        .limit(1)
        .then((rows) => rows[0] ?? null);

      if (existingMessage) {
        logger.info("Mensagem duplicada ignorada", { id: msg.key.id });
        continue;
      }

      // 4. Extrair conteúdo da mensagem
      const messageContent = extractMessageContent(msg.message);
      const messageType = mapMessageType(msg.messageType);
      const timestamp = new Date(
        typeof msg.messageTimestamp === "string"
          ? parseInt(msg.messageTimestamp, 10) * 1000
          : msg.messageTimestamp * 1000,
      );

      // 5. Criar mensagem
      const [newMessage] = await tenantDb
        .insert(message)
        .values({
          chatId: chatRecord.id,
          messageSource: "whatsapp",
          sender: "customer",
          senderId: contactRecord.id,
          messageType,
          content: messageContent.text,
          whatsappMessageId: msg.key.id,
          status: "received",
          timestamp,
        })
        .returning();

      if (!newMessage) {
        logger.error("Falha ao criar mensagem");
        continue;
      }

      logger.info("Mensagem salva no DB", { messageId: newMessage.id });

      // 6. Processar mídia se houver
      if (messageContent.hasMedia && messageContent.mediaUrl) {
        logger.info("Mensagem contém mídia", { type: messageType });

        const fileName = messageContent.fileName ?? `media-${msg.key.id}`;
        const mimeType = messageContent.mimeType ?? "application/octet-stream";

        const [newAttachment] = await tenantDb
          .insert(attachment)
          .values({
            messageId: newMessage.id,
            fileName,
            mimeType,
            mediaType: messageType === "text" ? "document" : messageType,
            whatsappMediaId: msg.key.id,
            storagePath: `temp/${msg.key.id}`, // Placeholder, será atualizado pelo worker
            downloadStatus: "pending",
          })
          .returning();

        if (newAttachment) {
          // Enfileirar job de download
          const mediaQueue = createMediaDownloadQueue(
            process.env.REDIS_URL ?? "redis://localhost:6379",
          );

          await mediaQueue.add("download-media", {
            organizationId: ch.organizationId,
            messageId: newMessage.id,
            attachmentId: newAttachment.id,
            whatsappMediaId: msg.key.id,
            instanceName,
            fileName,
            mimeType,
          });

          logger.info("Job de download enfileirado", {
            attachmentId: newAttachment.id,
          });
        }
      }

      // 7. Atualizar chat
      await tenantDb
        .update(chat)
        .set({
          lastMessageAt: timestamp,
          lastMessageContent: messageContent.text,
          lastMessageSender: "customer",
          unreadCount: chatRecord.unreadCount + 1,
          updatedAt: new Date(),
        })
        .where(
          and(eq(chat.id, chatRecord.id), eq(chat.createdAt, chatRecord.createdAt)),
        );

      // 8. Emitir evento Socket.io
      socketManager.emitToRoom(`org:${ch.organizationId}`, "message:new", {
        chatId: chatRecord.id,
        message: newMessage,
        contact: contactRecord,
      });

      logger.info("Mensagem processada com sucesso", { id: msg.key.id });
    } catch (error) {
      logger.error("Erro ao processar mensagem", error);
    }
  }
}

/**
 * Extrai conteúdo de texto e mídia da mensagem
 */
function extractMessageContent(messageObj: Record<string, unknown> | undefined): {
  text: string;
  hasMedia: boolean;
  mediaUrl?: string;
  mimeType?: string;
  fileName?: string;
  caption?: string;
} {
  if (!messageObj) {
    return { text: "", hasMedia: false };
  }

  // Mensagem de texto simples
  if (messageObj.conversation) {
    return {
      text: typeof messageObj.conversation === "string" ? messageObj.conversation : "",
      hasMedia: false,
    };
  }

  // Mensagem estendida (com preview de link)
  if (messageObj.extendedTextMessage) {
    const ext = messageObj.extendedTextMessage as Record<string, unknown>;
    return {
      text: typeof ext.text === "string" ? ext.text : "",
      hasMedia: false,
    };
  }

  // Imagem
  if (messageObj.imageMessage) {
    const img = messageObj.imageMessage as Record<string, unknown>;
    return {
      text: typeof img.caption === "string" ? img.caption : "",
      hasMedia: true,
      mediaUrl: typeof img.url === "string" ? img.url : "",
      mimeType: typeof img.mimetype === "string" ? img.mimetype : "image/jpeg",
      fileName: typeof img.fileName === "string" ? img.fileName : "image.jpg",
      caption: typeof img.caption === "string" ? img.caption : "",
    };
  }

  // Vídeo
  if (messageObj.videoMessage) {
    const vid = messageObj.videoMessage as Record<string, unknown>;
    return {
      text: typeof vid.caption === "string" ? vid.caption : "",
      hasMedia: true,
      mediaUrl: typeof vid.url === "string" ? vid.url : "",
      mimeType: typeof vid.mimetype === "string" ? vid.mimetype : "video/mp4",
      fileName: typeof vid.fileName === "string" ? vid.fileName : "video.mp4",
      caption: typeof vid.caption === "string" ? vid.caption : "",
    };
  }

  // Áudio
  if (messageObj.audioMessage) {
    const aud = messageObj.audioMessage as Record<string, unknown>;
    return {
      text: "[Áudio]",
      hasMedia: true,
      mediaUrl: typeof aud.url === "string" ? aud.url : "",
      mimeType: typeof aud.mimetype === "string" ? aud.mimetype : "audio/ogg",
      fileName: typeof aud.fileName === "string" ? aud.fileName : "audio.ogg",
    };
  }

  // Documento
  if (messageObj.documentMessage) {
    const doc = messageObj.documentMessage as Record<string, unknown>;
    const caption = typeof doc.caption === "string" ? doc.caption : "";
    const fileName = typeof doc.fileName === "string" ? doc.fileName : "document.pdf";
    return {
      text: caption || fileName || "[Documento]",
      hasMedia: true,
      mediaUrl: typeof doc.url === "string" ? doc.url : "",
      mimeType: typeof doc.mimetype === "string" ? doc.mimetype : "application/pdf",
      fileName,
      caption,
    };
  }

  return { text: "[Mensagem não suportada]", hasMedia: false };
}

/**
 * Mapeia messageType do Evolution API para nosso enum
 */
function mapMessageType(
  evType: string | undefined,
): "text" | "image" | "video" | "audio" | "document" {
  if (!evType) return "text";

  const lower = evType.toLowerCase();

  if (lower.includes("image")) return "image";
  if (lower.includes("video")) return "video";
  if (lower.includes("audio")) return "audio";
  if (lower.includes("document")) return "document";

  return "text";
}
