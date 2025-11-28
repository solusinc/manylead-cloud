import type { Channel, TenantDB } from "@manylead/db";
import type { TenantDatabaseManager } from "@manylead/tenant-db";
import { and, attachment, chat, contact, eq, message, sql } from "@manylead/db";
import { createMediaDownloadQueue } from "@manylead/shared/queue";

import type { MessageContent, MessageType } from "./message-content-extractor";
import type { MessageData } from "~/routes/webhooks/evolution/types";
import { getSocketManager } from "~/socket";
import { MessageContentExtractor } from "./message-content-extractor";
import { createLogger } from "~/libs/utils/logger";

const log = createLogger("WhatsAppMessageProcessor");

/**
 * Serviço para processar mensagens recebidas do WhatsApp
 *
 * Responsabilidades:
 * - Criar/atualizar contatos
 * - Criar/atualizar chats
 * - Salvar mensagens no DB
 * - Processar anexos e enfileirar downloads
 * - Emitir eventos Socket.io
 */
export class WhatsAppMessageProcessor {
  private contentExtractor: MessageContentExtractor;

  constructor(private tenantManager: TenantDatabaseManager) {
    this.contentExtractor = new MessageContentExtractor();
  }

  /**
   * Processa uma mensagem recebida do WhatsApp
   */
  async processMessage(
    msg: MessageData,
    channel: Channel,
    instanceName: string,
  ): Promise<void> {
    // Ignorar mensagens enviadas por nós
    if (msg.key.fromMe) {
      log.info({ id: msg.key.id }, "Ignoring our own message");
      return;
    }

    const phoneNumber = this.extractPhoneNumber(msg.key.remoteJid);
    if (!phoneNumber) {
      log.warn({ remoteJid: msg.key.remoteJid }, "Invalid phone number");
      return;
    }

    const tenantDb = await this.tenantManager.getConnection(
      channel.organizationId,
    );

    // 1. Garantir que contato existe
    const contactRecord = await this.ensureContact(
      tenantDb,
      channel.organizationId,
      phoneNumber,
      msg.pushName,
    );

    // 2. Garantir que chat existe
    const chatRecord = await this.ensureChat(
      tenantDb,
      channel.organizationId,
      contactRecord.id,
      channel.id,
    );

    // 3. Verificar se mensagem já existe (evitar duplicatas)
    if (await this.isDuplicate(tenantDb, msg.key.id)) {
      log.info({ id: msg.key.id }, "Duplicate message ignored");
      return;
    }

    // 4. Extrair conteúdo
    const messageContent = this.contentExtractor.extract(msg.message);
    const messageType = this.contentExtractor.mapType(msg.messageType);
    const timestamp = this.parseTimestamp(msg.messageTimestamp);

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
      throw new Error("Failed to create message");
    }

    log.info({ messageId: newMessage.id }, "Message saved");

    // 6. Processar mídia se houver
    if (messageContent.hasMedia && messageContent.mediaUrl) {
      await this.processMedia(
        tenantDb,
        newMessage.id,
        msg.key.id,
        messageContent,
        messageType,
        channel.organizationId,
        instanceName,
      );
    }

    // 7. Atualizar chat
    await this.updateChat(
      tenantDb,
      chatRecord.id,
      chatRecord.createdAt,
      timestamp,
      messageContent.text,
    );

    // 8. Emitir evento Socket.io
    const socketManager = getSocketManager();
    socketManager.emitToRoom(`org:${channel.organizationId}`, "message:new", {
      chatId: chatRecord.id,
      message: newMessage,
      contact: contactRecord,
    });

    log.info({ id: msg.key.id }, "Message processed successfully");
  }

  /**
   * Extrai número de telefone do remoteJid
   */
  private extractPhoneNumber(remoteJid: string): string | null {
    const phoneNumber = remoteJid.split("@")[0];
    return phoneNumber ?? null;
  }

  /**
   * Garante que contato existe, cria se necessário
   */
  private async ensureContact(
    tenantDb: TenantDB,
    organizationId: string,
    phoneNumber: string,
    pushName: string | undefined,
  ): Promise<typeof contact.$inferSelect> {
    // Buscar contato existente
    let contactRecord = await tenantDb
      .select()
      .from(contact)
      .where(eq(contact.phoneNumber, phoneNumber))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (!contactRecord) {
      log.info({ phoneNumber }, "Creating new contact");

      const [newContact] = await tenantDb
        .insert(contact)
        .values({
          organizationId,
          phoneNumber,
          name: pushName ?? phoneNumber,
          metadata: {
            source: "whatsapp" as const,
            firstMessageAt: new Date(),
            whatsappProfileName: pushName,
          },
        })
        .returning();

      if (!newContact) {
        throw new Error("Failed to create contact");
      }

      contactRecord = newContact;
    } else if (pushName && pushName !== contactRecord.name) {
      // Atualizar nome se diferente
      await tenantDb
        .update(contact)
        .set({
          name: pushName,
          updatedAt: new Date(),
        })
        .where(eq(contact.id, contactRecord.id));
    }

    return contactRecord;
  }

  /**
   * Garante que chat existe, cria se necessário
   */
  private async ensureChat(
    tenantDb: TenantDB,
    organizationId: string,
    contactId: string,
    channelId: string,
  ): Promise<typeof chat.$inferSelect> {
    // Buscar chat existente
    let chatRecord = await tenantDb
      .select()
      .from(chat)
      .where(
        and(
          eq(chat.contactId, contactId),
          eq(chat.channelId, channelId),
          eq(chat.messageSource, "whatsapp"),
        ),
      )
      .orderBy(chat.createdAt)
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (!chatRecord) {
      log.info({ contactId }, "Creating new chat");

      const [newChat] = await tenantDb
        .insert(chat)
        .values({
          organizationId,
          contactId,
          channelId,
          messageSource: "whatsapp",
          status: "open",
        })
        .returning();

      if (!newChat) {
        throw new Error("Failed to create chat");
      }

      chatRecord = newChat;

      // TODO: Aplicar auto-assignment (próxima fase)
    }

    return chatRecord;
  }

  /**
   * Verifica se mensagem já existe (duplicata)
   */
  private async isDuplicate(
    tenantDb: TenantDB,
    whatsappMessageId: string,
  ): Promise<boolean> {
    const existingMessage = await tenantDb
      .select()
      .from(message)
      .where(eq(message.whatsappMessageId, whatsappMessageId))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    return !!existingMessage;
  }

  /**
   * Processa anexos de mídia
   */
  private async processMedia(
    tenantDb: TenantDB,
    messageId: string,
    whatsappMessageId: string,
    messageContent: MessageContent,
    messageType: MessageType,
    organizationId: string,
    instanceName: string,
  ): Promise<void> {
    log.info({ type: messageType }, "Processing media");

    const fileName = messageContent.fileName ?? `media-${whatsappMessageId}`;
    const mimeType = messageContent.mimeType ?? "application/octet-stream";

    const [newAttachment] = await tenantDb
      .insert(attachment)
      .values({
        messageId,
        fileName,
        mimeType,
        mediaType: messageType === "text" ? "document" : messageType,
        whatsappMediaId: whatsappMessageId,
        storagePath: `temp/${whatsappMessageId}`,
        downloadStatus: "pending",
      })
      .returning();

    if (newAttachment) {
      // Enfileirar job de download
      const mediaQueue = createMediaDownloadQueue(
        process.env.REDIS_URL ?? "redis://localhost:6379",
      );

      await mediaQueue.add("download-media", {
        organizationId,
        messageId,
        attachmentId: newAttachment.id,
        whatsappMediaId: whatsappMessageId,
        instanceName,
        fileName,
        mimeType,
      });

      log.info({ attachmentId: newAttachment.id }, "Download job enqueued");
    }
  }

  /**
   * Atualiza chat com última mensagem
   */
  private async updateChat(
    tenantDb: TenantDB,
    chatId: string,
    chatCreatedAt: Date,
    timestamp: Date,
    content: string,
  ): Promise<void> {
    await tenantDb
      .update(chat)
      .set({
        lastMessageAt: timestamp,
        lastMessageContent: content,
        lastMessageSender: "customer",
        unreadCount: sql`COALESCE(${chat.unreadCount}, 0) + 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(chat.id, chatId), eq(chat.createdAt, chatCreatedAt)));
  }

  /**
   * Parse timestamp da Evolution API
   */
  private parseTimestamp(timestamp: string | number): Date {
    const ts =
      typeof timestamp === "string" ? parseInt(timestamp, 10) : timestamp;
    return new Date(ts * 1000);
  }
}
