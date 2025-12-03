import type { Channel, TenantDB, Chat } from "@manylead/db";
import type { TenantDatabaseManager } from "@manylead/tenant-db";
import { and, attachment, chat, contact, eq, message, sql } from "@manylead/db";
import { createMediaDownloadQueue } from "@manylead/shared/queue";
import { formatTime } from "@manylead/shared";
import { getDefaultDepartment, ChatParticipantService } from "@manylead/core-services";

import type { MessageContent, MessageType } from "./message-content-extractor";
import type { MessageData } from "~/routes/webhooks/evolution/types";
import { getSocketManager } from "~/socket";
import { MessageContentExtractor } from "./message-content-extractor";
import { createLogger } from "~/libs/utils/logger";
import { getEvolutionClient } from "~/libs/evolution-client";

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
    log.info("📨 [STEP 1] Iniciando processMessage", {
      messageId: msg.key.id,
      fromMe: msg.key.fromMe,
      remoteJid: msg.key.remoteJid,
    });

    // Ignorar mensagens enviadas por nós
    if (msg.key.fromMe) {
      log.info({ id: msg.key.id }, "⏭️  Ignoring our own message (fromMe=true)");
      return;
    }

    const phoneNumber = this.extractPhoneNumber(
      msg.key.remoteJid,
      msg.key.remoteJidAlt,
    );

    log.info("📞 [STEP 2] Phone number extraído", {
      phoneNumber,
    });

    if (!phoneNumber) {
      log.warn({ remoteJid: msg.key.remoteJid }, "❌ Invalid phone number");
      return;
    }

    log.info("🔌 [STEP 3] Obtendo conexão com tenant DB", {
      organizationId: channel.organizationId,
    });

    const tenantDb = await this.tenantManager.getConnection(
      channel.organizationId,
    );

    log.info("✅ Conexão obtida com sucesso");

    // 1. Garantir que contato existe
    log.info("👤 [STEP 4] Garantindo contato existe");
    const contactRecord = await this.ensureContact(
      tenantDb,
      channel.organizationId,
      phoneNumber,
      msg.pushName,
      instanceName,
    );
    log.info("✅ Contato garantido", {
      contactId: contactRecord.id,
      name: contactRecord.name,
      phoneNumber: contactRecord.phoneNumber,
    });

    // 2. Buscar chat existente
    log.info("💬 [STEP 5] Buscando chat existente");
    let chatRecord = await this.findExistingChat(
      tenantDb,
      contactRecord.id,
      channel.id,
    );

    // Se não encontrar, criar novo chat
    let isChatNew = false;
    if (!chatRecord) {
      log.info("Creating new chat");
      chatRecord = await this.createNewChat(
        tenantDb,
        channel.organizationId,
        contactRecord.id,
        channel.id,
      );
      isChatNew = true;

      // Criar mensagem de sistema "Sessão criada às HH:mm"
      log.info("📝 Criando mensagem de sistema 'Sessão criada'");
      const createdTime = formatTime(chatRecord.createdAt);

      const [systemMessage] = await tenantDb
        .insert(message)
        .values({
          chatId: chatRecord.id,
          messageSource: chatRecord.messageSource,
          sender: "system",
          senderId: null,
          messageType: "system",
          content: `Sessão criada às ${createdTime}`,
          status: "sent",
          timestamp: chatRecord.createdAt,
          metadata: {
            systemEventType: "session_created",
          },
        })
        .returning();

      if (!systemMessage) {
        throw new Error("Failed to create system message");
      }

      log.info("✅ Mensagem de sistema criada", {
        messageId: systemMessage.id,
        content: systemMessage.content,
      });

      // Emitir evento chat:created (como faz cross-org)
      // O evento chat:created já invalida queries e recarrega chats
      // Mensagens de sistema não precisam de evento separado (carregadas ao abrir chat)
      log.info("🔊 Emitindo evento chat:created");
      const socketManager = getSocketManager();
      socketManager.emitToRoom(`org:${channel.organizationId}`, "chat:created", {
        chat: chatRecord,
        contact: contactRecord,
      });
      log.info("✅ Evento chat:created emitido");

      // Guardar referência para emitir message:new junto com a primeira mensagem do cliente
      // Isso garante que o som toca corretamente (frontend precisa do chat já carregado)
      isChatNew = true;
    }

    log.info("✅ Chat garantido", {
      chatId: chatRecord.id,
      contactId: chatRecord.contactId,
      channelId: chatRecord.channelId,
      status: chatRecord.status,
      isNew: isChatNew,
    });

    // 3. Verificar se mensagem já existe (evitar duplicatas)
    log.info("🔍 [STEP 6] Verificando duplicata");
    if (await this.isDuplicate(tenantDb, msg.key.id)) {
      log.info({ id: msg.key.id }, "⏭️  Duplicate message ignored");
      return;
    }
    log.info("✅ Mensagem não é duplicata");

    // 4. Extrair conteúdo
    log.info("📝 [STEP 7] Extraindo conteúdo da mensagem");
    const messageContent = this.contentExtractor.extract(msg.message);
    const messageType = this.contentExtractor.mapType(msg.messageType);
    const timestamp = this.parseTimestamp(msg.messageTimestamp);
    log.info("✅ Conteúdo extraído", {
      messageType,
      hasMedia: messageContent.hasMedia,
      textLength: messageContent.text.length,
      timestamp: timestamp.toISOString(),
    });

    // 5. Criar mensagem
    const messageToInsert = {
      chatId: chatRecord.id,
      messageSource: "whatsapp" as const,
      sender: "customer" as const,
      senderId: contactRecord.id,
      messageType,
      content: messageContent.text,
      whatsappMessageId: msg.key.id,
      status: "received" as const,
      timestamp,
    };

    log.info("💾 [STEP 8] Inserindo mensagem no banco", {
      ...messageToInsert,
      contentPreview: messageContent.text.substring(0, 50),
      timestamp: timestamp.toISOString(),
    });

    const [newMessage] = await tenantDb
      .insert(message)
      .values(messageToInsert)
      .returning();

    if (!newMessage) {
      log.error("❌ FALHA CRÍTICA: Failed to create message");
      throw new Error("Failed to create message");
    }

    log.info("✅ [STEP 8] Mensagem salva no banco!", {
      messageId: newMessage.id,
      chatId: newMessage.chatId,
      content: newMessage.content.substring(0, 100),
      status: newMessage.status,
      whatsappMessageId: newMessage.whatsappMessageId,
    });

    // 6. Processar mídia se houver
    if (messageContent.hasMedia && messageContent.mediaUrl) {
      log.info("📎 [STEP 9] Processando mídia");
      await this.processMedia(
        tenantDb,
        newMessage.id,
        msg.key.id,
        messageContent,
        messageType,
        channel.organizationId,
        instanceName,
      );
      log.info("✅ Mídia processada");
    } else {
      log.info("⏭️  [STEP 9] Sem mídia para processar");
    }

    // 7. Atualizar chat
    log.info("🔄 [STEP 10] Atualizando chat");
    await this.updateChat(
      tenantDb,
      chatRecord.id,
      chatRecord.createdAt,
      timestamp,
      messageContent.text,
      chatRecord.assignedTo, // Passar assignedTo para incrementar participant
    );
    log.info("✅ Chat atualizado");

    // 8. Emitir evento Socket.io
    log.info("🔊 [STEP 11] Emitindo evento Socket.io");
    const socketManager = getSocketManager();

    const messagePayload = {
      chatId: chatRecord.id,
      message: newMessage,
      contact: contactRecord,
    };

    socketManager.emitToRoom(`org:${channel.organizationId}`, "message:new", messagePayload);

    log.info("✅ Evento emitido", {
      room: `org:${channel.organizationId}`,
      event: "message:new",
      messageId: newMessage.id,
      sender: newMessage.sender,
      senderId: newMessage.senderId,
      messageType: newMessage.messageType,
      isChatNew,
    });

    log.info("🎉 [CONCLUÍDO] Message processed successfully", {
      messageId: newMessage.id,
      whatsappMessageId: msg.key.id,
    });
  }

  /**
   * Extrai número de telefone do remoteJid
   * Prioriza remoteJidAlt (formato @s.whatsapp.net) sobre remoteJid (formato @lid)
   */
  private extractPhoneNumber(
    remoteJid: string,
    remoteJidAlt?: string,
  ): string | null {
    // Usar remoteJidAlt se disponível (formato padrão @s.whatsapp.net)
    const jid = remoteJidAlt ?? remoteJid;
    const phoneNumber = jid.split("@")[0];
    return phoneNumber ?? null;
  }

  /**
   * Garante que contato existe, cria se necessário
   * Atualiza foto de perfil periodicamente (throttle de 24h)
   */
  private async ensureContact(
    tenantDb: TenantDB,
    organizationId: string,
    phoneNumber: string,
    pushName: string | undefined,
    instanceName: string,
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

      // Buscar foto de perfil ao criar contato
      const profilePictureUrl = await this.fetchProfilePicture(
        instanceName,
        phoneNumber,
      );

      const [newContact] = await tenantDb
        .insert(contact)
        .values({
          organizationId,
          phoneNumber,
          name: pushName ?? phoneNumber,
          avatar: profilePictureUrl,
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
    } else {
      // Contato já existe - atualizar nome e foto se necessário
      const updates: Partial<typeof contact.$inferInsert> = {};
      let needsUpdate = false;

      // Atualizar nome se mudou
      if (pushName && pushName !== contactRecord.name) {
        updates.name = pushName;
        needsUpdate = true;
      }

      // TODO: Atualizar foto de perfil baseado em webhook event do Evolution API
      // ao invés de polling a cada 24h. Verificar se Evolution API emite evento
      // quando contato atualiza foto de perfil.
      // Ref: https://doc.evolution-api.com/v2/en/endpoints/webhook-events

      if (needsUpdate) {
        await tenantDb
          .update(contact)
          .set({
            ...updates,
            updatedAt: new Date(),
          })
          .where(eq(contact.id, contactRecord.id));

        // Recarregar contato atualizado
        contactRecord = {
          ...contactRecord,
          ...updates,
        };
      }
    }

    return contactRecord;
  }


  /**
   * Busca foto de perfil do contato na Evolution API
   * Retorna null se não encontrar (privacidade)
   */
  private async fetchProfilePicture(
    instanceName: string,
    phoneNumber: string,
  ): Promise<string | null> {
    try {
      const evolutionClient = getEvolutionClient();
      const result =
        await evolutionClient.instance.fetchProfilePicture(
          instanceName,
          phoneNumber,
        );
      return result.profilePictureUrl;
    } catch (error) {
      log.warn(
        { phoneNumber, error },
        "Failed to fetch profile picture (may be private)",
      );
      return null;
    }
  }

  /**
   * Buscar chat existente para contato/canal
   */
  private async findExistingChat(
    tenantDb: TenantDB,
    contactId: string,
    channelId: string,
  ): Promise<Chat | null> {
    const chatRecord = await tenantDb
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

    return chatRecord;
  }

  /**
   * Criar novo chat WhatsApp
   */
  private async createNewChat(
    tenantDb: TenantDB,
    organizationId: string,
    contactId: string,
    channelId: string,
  ): Promise<Chat> {
    // Buscar departamento padrão
    const defaultDepartmentId = await getDefaultDepartment(
      tenantDb,
      organizationId,
    );

    // IMPORTANTE: Definir createdAt/updatedAt explicitamente para evitar
    // problema de precisão timestamp (PostgreSQL usa microssegundos, JS usa milissegundos)
    const now = new Date();

    const [newChat] = await tenantDb
      .insert(chat)
      .values({
        organizationId,
        contactId,
        channelId,
        messageSource: "whatsapp",
        status: "pending", // Chat começa como pending até alguém atender
        departmentId: defaultDepartmentId,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    if (!newChat) {
      throw new Error("Failed to create chat");
    }

    return newChat;
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

      await mediaQueue.add(
        "download-media",
        {
          organizationId,
          messageId,
          attachmentId: newAttachment.id,
          whatsappMediaId: whatsappMessageId,
          instanceName,
          fileName,
          mimeType,
        },
        {
          jobId: `media-download-${organizationId}-${newAttachment.id}`,
        },
      );

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
    assignedTo: string | null,
  ): Promise<void> {
    await tenantDb
      .update(chat)
      .set({
        lastMessageAt: timestamp,
        lastMessageContent: content,
        lastMessageSender: "customer",
        lastMessageStatus: "delivered",
        unreadCount: sql`COALESCE(${chat.unreadCount}, 0) + 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(chat.id, chatId), eq(chat.createdAt, chatCreatedAt)));

    // Se chat está atribuído, incrementar unreadCount do participant também
    if (assignedTo) {
      const participantService = new ChatParticipantService(tenantDb);
      await participantService.incrementUnreadForAssignedAgent(
        chatId,
        chatCreatedAt,
        assignedTo,
      );
    }
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
