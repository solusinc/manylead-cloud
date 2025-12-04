import type { Job } from "bullmq";
import { eq, message, attachment, and, chat, sql } from "@manylead/db";
import { evolutionAPI } from "@manylead/evolution-api-client";
import { AudioConverterService } from "@manylead/messaging/whatsapp";
import { CircuitBreakerError } from "@manylead/clients";
import type { AudioSendJobData } from "@manylead/shared/queue";
import { logger } from "~/libs/utils/logger";
import { tenantManager } from "~/libs/tenant-manager";
import { evolutionCircuitBreaker } from "~/libs/evolution-circuit-breaker";
import { eventPublisher } from "~/libs/cache/event-publisher";

/**
 * Process audio send job
 *
 * Responsabilidades (SOLID - Single Responsibility):
 * - Converter áudio para formato WhatsApp
 * - Delegar envio para WhatsAppSenderService (reuso!)
 * - Atualizar status da mensagem
 * - Emitir evento Socket.io
 */
export async function processAudioSend(
  job: Job<AudioSendJobData>,
): Promise<void> {
  const {
    organizationId,
    chatId,
    messageId,
    attachmentId,
    instanceName,
    phoneNumber,
    audioUrl,
    audioStoragePath,
    audioMimeType,
    caption: _caption,
    quoted,
  } = job.data;

  logger.info(
    {
      jobId: job.id,
      organizationId,
      messageId,
      attachmentId,
      hasQuoted: !!quoted,
      quotedDetails: quoted,
    },
    "Starting audio conversion and send",
  );

  const tenantDb = await tenantManager.getConnection(organizationId);

  try {
    // 1. Converter áudio para formato WhatsApp
    logger.debug({ messageId, audioMimeType }, "Converting audio to WhatsApp format");

    const audioConverter = new AudioConverterService();
    const converted = await audioConverter.convertToWhatsAppFormat(
      organizationId,
      audioUrl,
      audioStoragePath,
      audioMimeType,
    );

    logger.info(
      {
        messageId,
        originalMimeType: audioMimeType,
        convertedMimeType: converted.convertedMimeType,
      },
      "Audio converted successfully",
    );

    // 2. Atualizar attachment com arquivo convertido
    await tenantDb
      .update(attachment)
      .set({
        storagePath: converted.convertedStoragePath,
        storageUrl: converted.convertedUrl,
        mimeType: converted.convertedMimeType,
        fileName: converted.convertedFileName,
      })
      .where(eq(attachment.id, attachmentId));

    logger.debug({ attachmentId }, "Attachment updated with converted audio");

    // 3. Usar o mesmo formato de quoted que funciona para texto!
    // Evolution API precisa de remoteJid e fromMe para renderizar reply-to corretamente
    const audioQuoted = quoted;

    if (audioQuoted) {
      logger.debug(
        { audioQuoted },
        "Using same quoted format as text (with remoteJid and fromMe)",
      );
    }

    // 4. Enviar para WhatsApp usando sendAudio (endpoint correto para áudio!)
    logger.debug({ instanceName, phoneNumber }, "Sending audio to WhatsApp");

    const result = await evolutionCircuitBreaker.execute(async () => {
      return evolutionAPI.message.sendAudio(instanceName, {
        number: phoneNumber,
        audio: converted.convertedUrl,
        ptt: true, // Push-to-talk (mensagem de voz com waveform)
        quoted: audioQuoted, // Reply to message (formato Evolution API)
      });
    });

    logger.info(
      {
        messageId,
        whatsappMessageId: result.key.id,
      },
      "Audio sent to WhatsApp successfully",
    );

    // 5. Atualizar mensagem com whatsappMessageId e status "sent"
    const [updatedMessage] = await tenantDb
      .update(message)
      .set({
        whatsappMessageId: result.key.id,
        status: "sent",
        sentAt: new Date(),
      })
      .where(
        and(
          eq(message.id, messageId),
          eq(message.chatId, chatId),
        ),
      )
      .returning();

    logger.info(
      { jobId: job.id, messageId, organizationId },
      "Audio send completed successfully",
    );

    // 6. Emitir evento Socket.io e atualizar chat
    if (updatedMessage) {
      // 6.1. Atualizar chat (lastMessage, totalMessages)
      const [updatedChat] = await tenantDb
        .update(chat)
        .set({
          lastMessageAt: updatedMessage.timestamp,
          lastMessageContent: updatedMessage.content || "Áudio",
          lastMessageSender: "agent",
          lastMessageStatus: "sent",
          lastMessageType: "audio",
          totalMessages: sql`${chat.totalMessages} + 1`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(chat.id, chatId),
          ),
        )
        .returning();

      // 6.2. Emitir evento chat:updated para atualizar sidebar
      if (updatedChat) {
        await eventPublisher.publish("chat:events", {
          type: "chat:updated",
          organizationId,
          chatId,
          data: {
            chat: updatedChat,
          },
        });
      }

      // 6.3. Emitir evento message:new
      const [attachmentRecord] = await tenantDb
        .select()
        .from(attachment)
        .where(eq(attachment.id, attachmentId))
        .limit(1);

      await eventPublisher.publish("message:events", {
        type: "message:new",
        organizationId,
        chatId,
        messageId,
        senderId: updatedMessage.senderId ?? undefined,
        data: {
          message: {
            ...updatedMessage,
            attachment: attachmentRecord,
            // Include metadata with tempId for optimistic UI replacement
            metadata: updatedMessage.metadata ?? undefined,
          },
        },
      });

      logger.info({ messageId }, "Socket.io event emitted");
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    if (error instanceof CircuitBreakerError) {
      logger.error(
        {
          jobId: job.id,
          organizationId,
          messageId,
          circuitState: error.state,
          error: errorMessage,
        },
        "Audio send failed - Circuit breaker OPEN",
      );
    } else {
      logger.error(
        {
          jobId: job.id,
          organizationId,
          messageId,
          error: errorMessage,
          stack: error instanceof Error ? error.stack : undefined,
        },
        "Audio send failed",
      );
    }

    try {
      await tenantDb
        .update(message)
        .set({ status: "failed" })
        .where(and(eq(message.id, messageId), eq(message.chatId, chatId)));

      logger.debug({ messageId }, "Message status updated to failed");
    } catch (updateError) {
      logger.error({ updateError }, "Failed to update message status");
    }

    throw error; // Trigger BullMQ retry
  }
}
