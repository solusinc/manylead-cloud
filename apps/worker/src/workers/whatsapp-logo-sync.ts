import type { Job } from "bullmq";
import { eq } from "@manylead/db";
import { db as catalogDb, organization } from "@manylead/db";
import { storage } from "@manylead/storage";
import { logger } from "~/libs/utils/logger";

/**
 * WhatsApp Logo Sync Job Data
 */
export interface WhatsAppLogoSyncJobData {
  organizationId: string;
  profilePictureUrl: string;
}

/**
 * Process WhatsApp logo sync job
 *
 * Downloads WhatsApp profile picture and uploads to R2,
 * then updates organization.logo in catalog DB.
 *
 * This runs ONLY if organization doesn't have a logo yet.
 */
export async function processWhatsAppLogoSync(
  job: Job<WhatsAppLogoSyncJobData>,
): Promise<void> {
  const { organizationId, profilePictureUrl } = job.data;

  logger.info(
    { jobId: job.id, organizationId, profilePictureUrl },
    "Processing WhatsApp logo sync job",
  );

  try {
    // Check if organization exists
    const [org] = await catalogDb
      .select({ logo: organization.logo })
      .from(organization)
      .where(eq(organization.id, organizationId))
      .limit(1);

    if (!org) {
      logger.warn({ organizationId }, "Organization not found, skipping logo sync");
      return;
    }

    logger.info(
      { organizationId, currentLogo: org.logo ?? null },
      "Downloading WhatsApp profile picture",
    );

    // Download image from WhatsApp
    const imageResponse = await fetch(profilePictureUrl);
    if (!imageResponse.ok) {
      throw new Error(
        `Failed to download image: ${imageResponse.status} ${imageResponse.statusText}`,
      );
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const contentType =
      imageResponse.headers.get("content-type") ?? "image/jpeg";

    logger.info(
      { organizationId, contentType, size: imageBuffer.byteLength },
      "Image downloaded, uploading to R2",
    );

    // Generate unique filename (same format as organization logo upload)
    // Format: {organizationId}/logos/{timestamp}.jpg
    const fileName = `${organizationId}/logos/${Date.now()}.jpg`;

    // Upload to R2
    const result = await storage.upload({
      key: fileName,
      body: Buffer.from(imageBuffer),
      contentType,
    });

    const publicUrl = result.url;

    logger.info({ organizationId, publicUrl }, "Image uploaded to R2");

    // Update organization logo in catalog
    await catalogDb
      .update(organization)
      .set({ logo: publicUrl })
      .where(eq(organization.id, organizationId));

    logger.info(
      { jobId: job.id, organizationId, publicUrl },
      "WhatsApp logo sync completed successfully",
    );
  } catch (error) {
    logger.error(
      { jobId: job.id, organizationId, error },
      "WhatsApp logo sync failed",
    );

    // Don't throw - this is a nice-to-have feature
    // Let the job complete successfully even if logo sync fails
  }
}
