import type { Job } from "bullmq";
import { attachment, eq, message } from "@manylead/db";
import { generateMediaPath } from "@manylead/storage/utils";
import { evolutionAPI } from "@manylead/evolution-api-client";
import { storage } from "@manylead/storage";
import { CircuitBreakerError } from "@manylead/clients";
import type { MediaDownloadJobData } from "@manylead/shared/queue";
import { logger } from "~/libs/utils/logger";
import { tenantManager } from "~/libs/tenant-manager";
import { evolutionCircuitBreaker } from "~/libs/evolution-circuit-breaker";
import { eventPublisher } from "~/libs/cache/event-publisher";

/**
 * Process media download job
 *
 * Downloads media from Evolution API and uploads to R2 storage
 */
export async function processMediaDownload(
  job: Job<MediaDownloadJobData>,
): Promise<void> {
  const {
    organizationId,
    chatId,
    messageId,
    attachmentId,
    whatsappMediaId,
    instanceName,
    fileName,
    mimeType,
    mediaUrl: _mediaUrl, // URL direta do WhatsApp (não usado - descriptografia precisa da Evolution API)
  } = job.data;

  logger.info(
    {
      jobId: job.id,
      organizationId,
      messageId,
      attachmentId,
      whatsappMediaId,
    },
    "Starting media download",
  );

  const tenantDb = await tenantManager.getConnection(organizationId);

  try {
    // Update status to downloading
    await tenantDb
      .update(attachment)
      .set({
        downloadStatus: "downloading",
      })
      .where(eq(attachment.id, attachmentId));

    logger.debug({ attachmentId }, "Attachment status updated to downloading");

    // Download media from Evolution API
    // Detectar mediaType do mimeType para passar corretamente à Evolution API
    let mediaType: "image" | "video" | "audio" | "document" = "document";
    if (mimeType.startsWith("image/")) {
      mediaType = "image";
    } else if (mimeType.startsWith("video/")) {
      mediaType = "video";
    } else if (mimeType.startsWith("audio/")) {
      mediaType = "audio";
    }

    logger.debug(
      { instanceName, whatsappMediaId, mimeType, mediaType },
      "Downloading media from Evolution API",
    );

    const mediaData = await evolutionCircuitBreaker.execute(async () => {
      return evolutionAPI.message.downloadMedia(instanceName, whatsappMediaId, mediaType);
    });

    logger.debug(
      { attachmentId, mimeType: mediaData.mimetype },
      "Media downloaded from Evolution API",
    );

    const buffer = Buffer.from(mediaData.base64, "base64");
    const fileSize = buffer.length;

    // Generate storage path (com mimeType para usar prefixo correto)
    const storagePath = generateMediaPath(organizationId, fileName, mimeType);

    logger.debug(
      { storagePath, fileSize },
      "Uploading media to R2",
    );

    // Upload to R2 (tags removidas - R2 pode não suportar x-amz-tagging header)
    const uploadResult = await storage.upload({
      key: storagePath,
      body: buffer,
      contentType: mimeType,
      metadata: {
        organizationId,
        messageId,
        attachmentId,
        whatsappMediaId,
      },
    });

    logger.info(
      { attachmentId, storageUrl: uploadResult.url, fileSize },
      "Media uploaded to R2 successfully",
    );

    // Update attachment with success
    const [updatedAttachment] = await tenantDb
      .update(attachment)
      .set({
        downloadStatus: "completed",
        storagePath: uploadResult.key,
        storageUrl: uploadResult.url,
        fileSize,
        downloadedAt: new Date(),
        downloadError: null,
      })
      .where(eq(attachment.id, attachmentId))
      .returning();

    logger.info(
      { jobId: job.id, attachmentId, organizationId },
      "Media download completed successfully",
    );

    // Buscar mensagem para emitir evento Socket.io completo
    const [messageRecord] = await tenantDb
      .select()
      .from(message)
      .where(eq(message.id, messageId))
      .limit(1);

    if (messageRecord && updatedAttachment) {
      // Emitir evento Socket.io com mensagem + attachment via Redis Pub/Sub
      // Formato deve ser igual ao EventPublisher.messageCreated()
      await eventPublisher.publish("message:events", {
        type: "message:new",
        organizationId,
        chatId,
        messageId,
        senderId: messageRecord.senderId ?? undefined,
        data: {
          message: {
            ...messageRecord,
            attachment: updatedAttachment,
          },
        },
      });

      logger.info(
        { messageId, attachmentId },
        "Socket.io event emitted for media message",
      );
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    // Special handling for circuit breaker errors
    if (error instanceof CircuitBreakerError) {
      logger.error(
        {
          jobId: job.id,
          organizationId,
          attachmentId,
          circuitState: error.state,
          circuitStats: error.stats,
          error: errorMessage,
        },
        "Media download failed - Evolution API circuit breaker is OPEN",
      );
    } else {
      logger.error(
        {
          jobId: job.id,
          organizationId,
          attachmentId,
          error: errorMessage,
          stack: error instanceof Error ? error.stack : undefined,
        },
        "Media download failed",
      );
    }

    try {
      // Update attachment with failure
      await tenantDb
        .update(attachment)
        .set({
          downloadStatus: "failed",
          downloadError: errorMessage,
        })
        .where(eq(attachment.id, attachmentId));

      logger.debug({ attachmentId }, "Attachment status updated to failed");
    } catch (updateError) {
      logger.error(
        {
          updateError:
            updateError instanceof Error
              ? updateError.message
              : String(updateError),
        },
        "Failed to update attachment status after download error",
      );
    }

    // Re-throw to trigger BullMQ retry
    throw error;
  }
}
