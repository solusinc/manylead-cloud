import { env } from "./env";
import { R2StorageProvider } from "./providers";

/**
 * Singleton do R2 Storage Provider
 */
const globalForStorage = globalThis as unknown as {
  storageClient: R2StorageProvider | undefined;
};

export const storage: R2StorageProvider =
  globalForStorage.storageClient ??
  new R2StorageProvider({
    accountId: env.R2_ACCOUNT_ID,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    bucketName: env.R2_BUCKET_NAME,
    publicUrl: env.R2_PUBLIC_URL,
  });

if (process.env.NODE_ENV !== "production") {
  globalForStorage.storageClient = storage;
}

/**
 * Extrai a key do R2 a partir da URL pública
 */
export function extractKeyFromUrl(url: string): string | null {
  if (!url.startsWith(env.R2_PUBLIC_URL)) {
    return null;
  }
  return url.slice(env.R2_PUBLIC_URL.length + 1);
}

/**
 * Retorna a URL pública do R2
 */
export function getPublicUrl(): string {
  return env.R2_PUBLIC_URL;
}
