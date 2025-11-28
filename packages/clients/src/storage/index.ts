import { S3Client } from "@aws-sdk/client-s3";
import type { CreateStorageClientOptions } from "./types";

// Singleton instance
let s3Client: S3Client | null = null;

/**
 * Create or retrieve S3-compatible storage client singleton (Cloudflare R2)
 *
 * Pattern: Singleton factory for R2/S3 client
 * Based on: packages/storage/src/client.ts, packages/storage/src/providers/r2.ts
 *
 * @example
 * ```typescript
 * import { createStorageClient } from "@manylead/clients/storage";
 * import { env } from "@manylead/clients";
 *
 * const s3 = createStorageClient({
 *   accountId: env.R2_ACCOUNT_ID,
 *   accessKeyId: env.R2_ACCESS_KEY_ID,
 *   secretAccessKey: env.R2_SECRET_ACCESS_KEY,
 *   bucketName: env.R2_BUCKET_NAME,
 *   publicUrl: env.R2_PUBLIC_URL,
 * });
 * ```
 */
export function createStorageClient(
  options: CreateStorageClientOptions,
): S3Client {
  const {
    accountId,
    accessKeyId,
    secretAccessKey,
    region = "auto",
    config = {},
    logger,
  } = options;

  // Return existing client if available
  if (s3Client) {
    return s3Client;
  }

  // Create R2 client
  s3Client = new S3Client({
    region,
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    ...config,
  });

  if (logger) {
    logger.info("Storage client created (Cloudflare R2)");
  }

  return s3Client;
}

/**
 * Get existing storage client (throws if not created)
 *
 * @example
 * ```typescript
 * const s3 = getStorageClient();
 * ```
 */
export function getStorageClient(): S3Client {
  if (!s3Client) {
    throw new Error(
      "Storage client not initialized. Call createStorageClient() first.",
    );
  }
  return s3Client;
}

/**
 * Destroy storage client
 *
 * @example
 * ```typescript
 * destroyStorageClient();
 * ```
 */
export function destroyStorageClient(): void {
  if (s3Client) {
    s3Client.destroy();
    s3Client = null;
  }
}

export type { S3Client, S3ClientConfig } from "@aws-sdk/client-s3";
export * from "./types";
