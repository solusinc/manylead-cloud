import type { Job } from "bullmq";
import { attachment, eq } from "@manylead/db";
import {
  generateMediaPath,
  getMediaTypeFromMimeType,
  getR2TagsForMedia,
} from "@manylead/storage/utils";
import { evolutionAPI } from "@manylead/evolution-api-client";
import { storage } from "@manylead/storage";
import { CircuitBreakerError } from "@manylead/clients";
import { logger } from "~/libs/utils/logger";
import { tenantManager } from "~/libs/tenant-manager";
import { evolutionCircuitBreaker } from "~/libs/evolution-circuit-breaker";

/**
 * Media download job data schema
 */
export interface MediaDownloadJobData {
  organizationId: string;
  messageId: string;
  attachmentId: string;
  whatsappMediaId: string;
  instanceName: string;
  fileName: string;
  mimeType: string;
}

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
    messageId,
    attachmentId,
    whatsappMediaId,
    instanceName,
    fileName,
    mimeType,
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

    // Download media from Evolution API (with circuit breaker protection)
    logger.debug(
      { instanceName, whatsappMediaId },
      "Downloading media from Evolution API",
    );

    const mediaData = await evolutionCircuitBreaker.execute(async () => {
      return evolutionAPI.message.downloadMedia(instanceName, whatsappMediaId);
    });

    logger.debug(
      { attachmentId, mimeType: mediaData.mimetype },
      "Media downloaded from Evolution API",
    );

    // Convert base64 to buffer
    const buffer = Buffer.from(mediaData.base64, "base64");
    const fileSize = buffer.length;

    // Generate storage path (com mimeType para usar prefixo correto)
    const storagePath = generateMediaPath(organizationId, fileName, mimeType);
    const mediaType = getMediaTypeFromMimeType(mimeType);
    const tags = getR2TagsForMedia(mediaType);

    logger.debug(
      { storagePath, mediaType, fileSize },
      "Uploading media to R2",
    );

    // Upload to R2
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
      tags,
    });

    logger.info(
      { attachmentId, storageUrl: uploadResult.url, fileSize },
      "Media uploaded to R2 successfully",
    );

    // Update attachment with success
    await tenantDb
      .update(attachment)
      .set({
        downloadStatus: "completed",
        storagePath: uploadResult.key,
        storageUrl: uploadResult.url,
        fileSize,
        downloadedAt: new Date(),
        downloadError: null,
      })
      .where(eq(attachment.id, attachmentId));

    logger.info(
      { jobId: job.id, attachmentId, organizationId },
      "Media download completed successfully",
    );
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
