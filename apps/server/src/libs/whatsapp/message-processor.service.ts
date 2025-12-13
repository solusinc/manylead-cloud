import type { Channel, TenantDB, Chat, Attachment } from "@manylead/db";
import type { TenantDatabaseManager } from "@manylead/tenant-db";
import { and, attachment, chat, chatRating, contact, desc, eq, message, or, sql } from "@manylead/db";
import { createMediaDownloadQueue } from "@manylead/shared/queue";
import { formatTime } from "@manylead/shared";
import { getDefaultDepartment, ChatParticipantService, getEventPublisher, getChatAutoMessagesService } from "@manylead/core-services";

import type { MessageContent, MessageType } from "./message-content-extractor";
import type { MessageData } from "~/routes/webhooks/evolution/types";
import { getSocketManager } from "~/socket";
import { MessageContentExtractor } from "./message-content-extractor";
import { createLogger } from "~/libs/utils/logger";
import { getEvolutionClient } from "~/libs/evolution-client";
import { env } from "~/env";

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
      return;
    }

    // Detectar se é mensagem de grupo
    const isGroup = msg.key.remoteJid.endsWith("@g.us");
    const groupJid = isGroup ? msg.key.remoteJid.split("@")[0] : null;

    // Para grupos: participant é quem enviou a mensagem
    // Para individuais: extrair phoneNumber do remoteJid
    const phoneNumber = isGroup
      ? null
      : this.extractPhoneNumber(msg.key.remoteJid, msg.key.remoteJidAlt);

    // Log para debug
    log.info({
      remoteJid: msg.key.remoteJid,
      remoteJidAlt: msg.key.remoteJidAlt,
      isGroup,
      groupJid,
      phoneNumber,
      participant: msg.key.participant,
    }, "Processing message from webhook");

    // Validar identificador
    if (!isGroup && !phoneNumber) {
      log.warn({ remoteJid: msg.key.remoteJid }, "Invalid phone number");
      return;
    }

    const tenantDb = await this.tenantManager.getConnection(
      channel.organizationId,
    );

    // 0. Verificar se há chat aguardando rating ANTES de criar/buscar chat
    // Se houver, processar a resposta de rating
    if (!isGroup && phoneNumber) {
      const ratingProcessed = await this.checkAndProcessRatingResponse(
        tenantDb,
        channel,
        phoneNumber,
        msg,
        instanceName,
      );

      if (ratingProcessed) {
        // Rating foi processado, não continuar com fluxo normal
        return;
      }
    }

    // 1. Garantir que contato existe
    const contactRecord = isGroup
      ? await this.ensureGroupContact(
          tenantDb,
          channel.organizationId,
          groupJid ?? "",
          msg.pushName, // Nome do grupo
          instanceName,
        )
      : await this.ensureContact(
          tenantDb,
          channel.organizationId,
          phoneNumber ?? "",
          msg.pushName,
          instanceName,
        );

    // 2. Buscar chat existente
    let chatRecord = await this.findExistingChat(
      tenantDb,
      contactRecord.id,
      channel.id,
    );

    // Se não encontrar, criar novo chat
    let isChatNew = false;
    if (!chatRecord) {
      chatRecord = await this.createNewChat(
        tenantDb,
        channel.organizationId,
        contactRecord.id,
        channel.id,
      );
      isChatNew = true;

      // Criar mensagem de sistema "Sessão criada às HH:mm"
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

      // Emitir evento chat:created
      const socketManager = getSocketManager();
      socketManager.emitToRoom(`org:${channel.organizationId}`, "chat:created", {
        chat: chatRecord,
        contact: contactRecord,
      });

      log.info("New chat created", {
        chatId: chatRecord.id,
        contactId: contactRecord.id,
      });
    }

    // TODO: FIX - Detectar mensagens editadas do WhatsApp → Dashboard
    // Evolution API Issue #2010: Evolution API não envia webhooks de edição
    // Ref: https://github.com/EvolutionAPI/evolution-api/issues/2010
    // Status: Aguardando fix da Evolution API
    // Nota: Dashboard → WhatsApp funciona perfeitamente via updateWhatsAppMessage

    // 3. Verificar se mensagem já existe (evitar duplicatas)
    if (await this.isDuplicate(tenantDb, msg.key.id)) {
      return;
    }

    // 5. Extrair conteúdo
    const messageContent = this.contentExtractor.extract(msg.message);
    const messageType = this.contentExtractor.mapType(msg.messageType);
    const timestamp = this.parseTimestamp(msg.messageTimestamp);

    // 5. Buscar mensagem citada se existir
    let repliedToMessageId: string | null = null;
    let replyMetadata: Record<string, unknown> | null = null;

    if (msg.contextInfo?.quotedMessage) {
      const quotedStanzaId = msg.contextInfo.stanzaId as string | undefined;

      if (quotedStanzaId) {
        const [repliedMessage] = await tenantDb
          .select({
            id: message.id,
            content: message.content,
            senderName: message.senderName,
            sender: message.sender,
            messageType: message.messageType,
          })
          .from(message)
          .where(
            and(
              eq(message.chatId, chatRecord.id),
              eq(message.whatsappMessageId, quotedStanzaId),
            ),
          )
          .limit(1);

        if (repliedMessage) {
          repliedToMessageId = repliedMessage.id;
          replyMetadata = {
            repliedToMessageId: repliedMessage.id,
            repliedToContent: repliedMessage.content,
            repliedToSender: repliedMessage.senderName ?? repliedMessage.sender,
            repliedToMessageType: repliedMessage.messageType,
          };
        }
      }
    }

    // 6. Criar mensagem
    // Construir metadata com info de participante para grupos
    let messageMetadata: Record<string, unknown> | null = replyMetadata;

    if (isGroup && msg.key.participant) {
      // Para grupos: adicionar info do participante que enviou a mensagem
      const participantJid = msg.key.participant.split("@")[0];
      const participantMetadata = {
        participantJid,
        participantName: msg.pushName ?? participantJid,
      };

      messageMetadata = messageMetadata
        ? { ...messageMetadata, ...participantMetadata }
        : participantMetadata;
    }

    const messageToInsert = {
      chatId: chatRecord.id,
      messageSource: "whatsapp" as const,
      sender: "customer" as const,
      senderId: null, // Customer não tem senderId (para auto-cancel funcionar)
      messageType,
      content: messageContent.text,
      whatsappMessageId: msg.key.id,
      status: "received" as const,
      timestamp,
      repliedToMessageId,
      metadata: messageMetadata,
    };

    const [newMessage] = await tenantDb
      .insert(message)
      .values(messageToInsert)
      .returning();

    if (!newMessage) {
      log.error("Failed to create message");
      throw new Error("Failed to create message");
    }

    // 6. Processar mídia se houver
    if (messageContent.hasMedia && messageContent.mediaUrl) {
      await this.processMedia(
        tenantDb,
        chatRecord.id, // chatId
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
      messageType,
      chatRecord.assignedTo,
    );

    // 8. Emitir evento para auto-cancelamento de scheduled messages
    // Mensagens do customer sempre têm sender="customer", então mapear para "contact"
    const eventPublisher = getEventPublisher(env.REDIS_URL);
    await eventPublisher.messageCreated(
      channel.organizationId,
      chatRecord.id,
      newMessage,
      {
        senderId: undefined, // Customer não tem senderId de agent, forçar undefined para emitir como "contact"
      },
    );

    // 9. Emitir evento Socket.io SOMENTE se NÃO for mídia
    // Mídia: Worker emite após completar download e ter storageUrl
    // Texto: Emite imediatamente
    log.info({
      hasMedia: messageContent.hasMedia,
      mediaUrl: messageContent.mediaUrl,
      messageType,
    }, "Checking if should emit Socket.io immediately");

    if (!messageContent.hasMedia) {
      const socketManager = getSocketManager();

      const messagePayload = {
        chatId: chatRecord.id,
        message: newMessage,
        contact: contactRecord,
      };

      socketManager.emitToRoom(`org:${channel.organizationId}`, "message:new", messagePayload);
      log.info("Socket.io emitted immediately (text message)");
    } else {
      log.info("Socket.io NOT emitted (media - worker will emit after download)");
    }

    // 10. Enviar welcome/out-of-hours message APÓS salvar mensagem do cliente (para garantir ordem correta)
    if (isChatNew) {
      await this.sendAutoMessage(
        tenantDb,
        channel,
        chatRecord,
        contactRecord,
        instanceName,
      );
    }

    log.info("Message processed", {
      messageId: newMessage.id,
      chatId: chatRecord.id,
      isNewChat: isChatNew,
    });
  }

  /**
   * TODO: DISABLED - Aguardando Evolution API Issue #2010
   * Evolution API não envia webhooks de mensagens editadas
   * Ref: https://github.com/EvolutionAPI/evolution-api/issues/2010
   *
   * Processa mensagem editada recebida do WhatsApp
   *
   * Fluxo:
   * 1. Extrai novo conteúdo do editedMessage
   * 2. Busca mensagem original pelo whatsappMessageId
   * 3. Atualiza content, isEdited, editedAt
   * 4. Atualiza chat.lastMessageContent se for última mensagem
   * 5. Emite evento Socket.io message:updated
   */
  /*
  private async processEditedMessage(
    tenantDb: TenantDB,
    msg: MessageData,
    chatId: string,
    organizationId: string,
  ): Promise<void> {
    ...
  }
  */

  /**
   * Extrai número de telefone do remoteJid
   * Prioriza remoteJid (número real @s.whatsapp.net) sobre remoteJidAlt (LID @lid)
   */
  private extractPhoneNumber(
    remoteJid: string,
    remoteJidAlt?: string,
  ): string | null {
    // Priorizar remoteJid (número real) se terminar com @s.whatsapp.net
    // Caso contrário usar remoteJidAlt (pode ter o número real quando remoteJid é LID)
    let jid = remoteJid;

    if (remoteJid.endsWith("@lid") && remoteJidAlt?.endsWith("@s.whatsapp.net")) {
      jid = remoteJidAlt;
    }

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
   * Garante que contato de grupo existe, cria se necessário
   */
  private async ensureGroupContact(
    tenantDb: TenantDB,
    organizationId: string,
    groupJid: string,
    _participantName: string | undefined, // pushName é do participante, não do grupo
    instanceName: string,
  ): Promise<typeof contact.$inferSelect> {
    // Buscar contato de grupo existente pelo JID
    let contactRecord = await tenantDb
      .select()
      .from(contact)
      .where(
        and(
          eq(contact.organizationId, organizationId),
          eq(contact.groupJid, groupJid),
        ),
      )
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (!contactRecord) {
      // Buscar info do grupo na Evolution API (nome e foto)
      const groupInfo = await this.fetchGroupInfo(instanceName, groupJid);
      const groupName = groupInfo?.subject ?? `Grupo ${groupJid}`;
      const groupPictureUrl = groupInfo?.pictureUrl ?? null;

      const [newContact] = await tenantDb
        .insert(contact)
        .values({
          organizationId,
          phoneNumber: null, // Grupos não têm phoneNumber
          isGroup: true,
          groupJid,
          name: groupName,
          avatar: groupPictureUrl,
          metadata: {
            source: "whatsapp" as const,
            firstMessageAt: new Date(),
            whatsappProfileName: groupName,
          },
        })
        .returning();

      if (!newContact) {
        throw new Error("Failed to create group contact");
      }

      contactRecord = newContact;
      log.info({ groupJid, name: contactRecord.name }, "Group contact created");
    }

    return contactRecord;
  }

  /**
   * Busca informações do grupo na Evolution API
   * Endpoint: GET /group/findGroupInfos/{instance}?groupJid={groupJid}
   */
  private async fetchGroupInfo(
    instanceName: string,
    groupJid: string,
  ): Promise<{ subject: string; pictureUrl: string | null } | null> {
    try {
      const evolutionClient = getEvolutionClient();
      const groupInfo = await evolutionClient.group.findGroupInfos(
        instanceName,
        `${groupJid}@g.us`,
      );

      if (groupInfo) {
        return {
          subject: groupInfo.subject,
          pictureUrl: groupInfo.pictureUrl ?? null,
        };
      }
      return null;
    } catch (error) {
      log.warn(
        { groupJid, error },
        "Failed to fetch group info",
      );
      return null;
    }
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
   * Busca apenas chats open/pending (ignora closed/snoozed)
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
          or(eq(chat.status, "open"), eq(chat.status, "pending")),
        ),
      )
      .orderBy(desc(chat.createdAt)) // Mais recente primeiro
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
   * Retorna o attachment criado para ser incluído no evento Socket.io
   */
  private async processMedia(
    tenantDb: TenantDB,
    chatId: string,
    messageId: string,
    whatsappMediaId: string,
    messageContent: MessageContent,
    messageType: MessageType,
    organizationId: string,
    instanceName: string,
  ): Promise<Attachment | null> {
    const fileName = messageContent.fileName ?? `media-${whatsappMediaId}`;
    const mimeType = messageContent.mimeType ?? "application/octet-stream";

    const [newAttachment] = await tenantDb
      .insert(attachment)
      .values({
        messageId,
        fileName,
        mimeType,
        mediaType: messageType === "text" ? "document" : messageType,
        whatsappMediaId: whatsappMediaId,
        storagePath: `temp/${whatsappMediaId}`,
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
          chatId,
          messageId,
          attachmentId: newAttachment.id,
          whatsappMediaId: whatsappMediaId,
          instanceName,
          fileName,
          mimeType,
          mediaUrl: messageContent.mediaUrl, // URL direta do WhatsApp (workaround para bug Evolution API)
        },
        {
          jobId: `media-download-${organizationId}-${newAttachment.id}`,
        },
      );
    }

    return newAttachment ?? null;
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
    messageType: MessageType,
    assignedTo: string | null,
  ): Promise<void> {
    await tenantDb
      .update(chat)
      .set({
        lastMessageAt: timestamp,
        lastMessageContent: content,
        lastMessageSender: "customer",
        lastMessageStatus: "delivered",
        lastMessageType: messageType,
        lastMessageIsDeleted: false,
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

  /**
   * Verificar e processar resposta de rating
   *
   * @returns true se o rating foi processado (não continuar fluxo normal)
   */
  private async checkAndProcessRatingResponse(
    tenantDb: TenantDB,
    channel: Channel,
    phoneNumber: string,
    msg: MessageData,
    instanceName: string,
  ): Promise<boolean> {
    // Buscar contato pelo phoneNumber
    const [contactRecord] = await tenantDb
      .select()
      .from(contact)
      .where(eq(contact.phoneNumber, phoneNumber))
      .limit(1);

    if (!contactRecord) {
      return false;
    }

    // Buscar chat fechado aguardando rating
    const [awaitingRatingChat] = await tenantDb
      .select()
      .from(chat)
      .where(
        and(
          eq(chat.contactId, contactRecord.id),
          eq(chat.channelId, channel.id),
          eq(chat.status, "closed"),
          eq(chat.ratingStatus, "awaiting"),
        ),
      )
      .orderBy(desc(chat.updatedAt))
      .limit(1);

    if (!awaitingRatingChat) {
      return false;
    }

    // Extrair conteúdo da mensagem
    const messageContent = this.contentExtractor.extract(msg.message);
    const rating = this.parseRatingResponse(messageContent.text);

    if (rating) {
      // Rating válido (1-5) - processar
      await this.processValidRating(
        tenantDb,
        channel,
        awaitingRatingChat,
        contactRecord,
        rating,
        msg,
        instanceName,
      );
      return true;
    }

    // Resposta inválida - limpar ratingStatus para permitir novo chat
    await tenantDb
      .update(chat)
      .set({ ratingStatus: null })
      .where(
        and(
          eq(chat.id, awaitingRatingChat.id),
          eq(chat.createdAt, awaitingRatingChat.createdAt),
        ),
      );

    log.info(
      { chatId: awaitingRatingChat.id, response: messageContent.text },
      "Invalid rating response, clearing status for new chat",
    );

    return false; // Continuar fluxo normal (criar novo chat)
  }

  /**
   * Parse resposta de rating
   * @returns número 1-5 ou null se inválido
   */
  private parseRatingResponse(content: string | undefined): number | null {
    if (!content) return null;
    const trimmed = content.trim();
    return /^[1-5]$/.test(trimmed) ? parseInt(trimmed, 10) : null;
  }

  /**
   * Processar rating válido
   */
  private async processValidRating(
    tenantDb: TenantDB,
    channel: Channel,
    chatRecord: Chat,
    contactRecord: typeof contact.$inferSelect,
    rating: number,
    msg: MessageData,
    instanceName: string,
  ): Promise<void> {
    const now = new Date();
    const timestamp = this.parseTimestamp(msg.messageTimestamp);

    // 1. Salvar rating na tabela chat_rating
    await tenantDb.insert(chatRating).values({
      chatId: chatRecord.id,
      chatCreatedAt: chatRecord.createdAt,
      contactId: contactRecord.id,
      rating,
      ratedAt: now,
    });

    // 2. Salvar mensagem do rating (como system para não aparecer na lista de mensagens)
    const [_ratingMessage] = await tenantDb
      .insert(message)
      .values({
        chatId: chatRecord.id,
        messageSource: "whatsapp",
        sender: "system",
        senderId: null,
        messageType: "system",
        content: String(rating),
        whatsappMessageId: msg.key.id,
        status: "received",
        timestamp,
        metadata: { systemEventType: "rating_value" },
      })
      .returning();

    // 3. Atualizar chat com ratingStatus = received
    // NÃO atualizar lastMessage - mensagens de rating não devem aparecer na sidebar
    await tenantDb
      .update(chat)
      .set({
        ratingStatus: "received",
        updatedAt: now,
      })
      .where(
        and(eq(chat.id, chatRecord.id), eq(chat.createdAt, chatRecord.createdAt)),
      );

    // 4. Enviar agradecimento via WhatsApp
    const thankYouMessage = "Agradecemos a sua avaliação!";
    let whatsappMessageId: string | null = null;

    try {
      const evolutionClient = getEvolutionClient();
      const result = await evolutionClient.message.sendText(instanceName, {
        number: contactRecord.phoneNumber ?? "",
        text: thankYouMessage,
      });
      whatsappMessageId = result.key.id;
    } catch (error) {
      log.error({ error, chatId: chatRecord.id }, "Failed to send rating thanks via WhatsApp");
    }

    // 5. Salvar mensagem de agradecimento
    const [_thanksMessage] = await tenantDb
      .insert(message)
      .values({
        chatId: chatRecord.id,
        messageSource: "whatsapp",
        sender: "system",
        senderId: null,
        messageType: "system",
        content: thankYouMessage,
        whatsappMessageId,
        status: "sent",
        timestamp: now,
        metadata: { systemEventType: "rating_thanks" },
      })
      .returning();

    // 6. NÃO atualizar lastMessage - mensagens de rating/agradecimento não devem aparecer na sidebar

    // 7. Emitir apenas evento de chat atualizado (sem eventos de mensagem para evitar loops)
    const eventPublisher = getEventPublisher(env.REDIS_URL);

    // Buscar chat atualizado para emitir evento
    const [updatedChat] = await tenantDb
      .select()
      .from(chat)
      .where(
        and(eq(chat.id, chatRecord.id), eq(chat.createdAt, chatRecord.createdAt)),
      )
      .limit(1);

    if (updatedChat) {
      await eventPublisher.chatUpdated(channel.organizationId, updatedChat);
    }

    log.info(
      { chatId: chatRecord.id, rating, contactId: contactRecord.id },
      "Rating processed successfully",
    );
  }

  /**
   * Enviar welcome ou out-of-hours message para novo chat
   * Usa ChatAutoMessagesService centralizado
   */
  private async sendAutoMessage(
    tenantDb: TenantDB,
    channel: Channel,
    chatRecord: Chat,
    contactRecord: typeof contact.$inferSelect,
    instanceName: string,
  ): Promise<void> {
    const autoMessagesService = getChatAutoMessagesService(env.REDIS_URL);
    const ctx = {
      organizationId: channel.organizationId,
      tenantDb,
    };

    // Callback para enviar via WhatsApp
    const sendWhatsApp = async (text: string): Promise<string | null> => {
      const targetNumber = contactRecord.isGroup
        ? contactRecord.groupJid
        : contactRecord.phoneNumber;

      if (!targetNumber) {
        log.warn({ chatId: chatRecord.id }, "No target number for auto message");
        return null;
      }

      try {
        const evolutionClient = getEvolutionClient();
        const result = await evolutionClient.message.sendText(instanceName, {
          number: targetNumber,
          text,
        });
        return result.key.id;
      } catch (error) {
        log.error({ error, chatId: chatRecord.id }, "Failed to send auto message via WhatsApp");
        return null;
      }
    };

    // Verificar se está dentro do horário de trabalho
    const isWithinHours = await autoMessagesService.isWithinWorkingHours(ctx);

    let newMessage;
    if (isWithinHours) {
      // Dentro do horário: enviar welcome message
      newMessage = await autoMessagesService.sendWelcomeMessage(
        ctx,
        chatRecord,
        "whatsapp",
        sendWhatsApp,
      );

      if (newMessage) {
        log.info({ chatId: chatRecord.id }, "Welcome message sent");
      }
    } else {
      // Fora do horário: enviar out-of-hours message (NÃO envia welcome)
      newMessage = await autoMessagesService.sendOutOfHoursMessage(
        ctx,
        chatRecord,
        "whatsapp",
        sendWhatsApp,
      );

      if (newMessage) {
        log.info({ chatId: chatRecord.id }, "Out of hours message sent");
      }
    }

    // Emitir via Socket.io (para o dashboard)
    if (newMessage) {
      const socketManager = getSocketManager();
      socketManager.emitToRoom(`org:${channel.organizationId}`, "message:new", {
        chatId: chatRecord.id,
        message: newMessage,
        contact: contactRecord,
      });
    }
  }
}
