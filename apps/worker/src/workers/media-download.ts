import type { Job } from "bullmq";
import { attachment, eq } from "@manylead/db";
import { TenantDatabaseManager } from "@manylead/tenant-db";
import { R2StorageProvider } from "@manylead/storage/providers";
import {
  generateMediaPath,
  getMediaTypeFromMimeType,
  getR2TagsForMedia,
} from "@manylead/storage/utils";
import { EvolutionAPIClient } from "@manylead/evolution-api-client";
import { logger } from "~/libs/utils/logger";
import { env } from "~/env";

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
 * Initialize R2 Storage Provider
 */
const storageProvider = new R2StorageProvider({
  accountId: env.R2_ACCOUNT_ID,
  accessKeyId: env.R2_ACCESS_KEY_ID,
  secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  bucketName: env.R2_BUCKET_NAME,
  publicUrl: env.R2_PUBLIC_URL,
});

/**
 * Initialize Evolution API Client
 */
const evolutionClient = new EvolutionAPIClient(
  env.EVOLUTION_API_URL,
  env.EVOLUTION_API_KEY,
);

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

  const tenantManager = new TenantDatabaseManager();
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
    logger.debug(
      { instanceName, whatsappMediaId },
      "Downloading media from Evolution API",
    );

    const mediaData = await evolutionClient.message.downloadMedia(
      instanceName,
      whatsappMediaId,
    );

    logger.debug(
      { attachmentId, mimeType: mediaData.mimetype },
      "Media downloaded from Evolution API",
    );

    // Convert base64 to buffer
    const buffer = Buffer.from(mediaData.base64, "base64");
    const fileSize = buffer.length;

    // Generate storage path
    const storagePath = generateMediaPath(organizationId, fileName);
    const mediaType = getMediaTypeFromMimeType(mimeType);
    const tags = getR2TagsForMedia(mediaType);

    logger.debug(
      { storagePath, mediaType, fileSize },
      "Uploading media to R2",
    );

    // Upload to R2
    const uploadResult = await storageProvider.upload({
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
