import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "./env";

const ALGORITHM = "aes-256-gcm";

/**
 * Encrypted data structure
 */
export interface EncryptedData {
  encrypted: string;
  iv: string;
  tag: string;
}

/**
 * Encrypts sensitive data using AES-256-GCM
 * Used for storing Baileys authState and BYOC access tokens in database
 *
 * @param data - Data to encrypt (will be JSON stringified)
 * @returns Object with encrypted data, IV, and auth tag
 *
 * @example
 * ```ts
 * const encrypted = encrypt({ apiKey: "secret123" });
 * // Store: encrypted.encrypted, encrypted.iv, encrypted.tag in separate columns
 * ```
 */
export function encrypt(data: unknown): EncryptedData {
  const dataString = JSON.stringify(data);

  // Generate random IV (Initialization Vector) - 16 bytes for AES
  const iv = randomBytes(16);

  // Get key from env (already validated as 32 bytes hex)
  const key = Buffer.from(env.ENCRYPTION_KEY, "hex");

  // Create cipher
  const cipher = createCipheriv(ALGORITHM, key, iv);

  // Encrypt data
  let encrypted = cipher.update(dataString, "utf8", "hex");
  encrypted += cipher.final("hex");

  // Get auth tag for GCM mode (provides authentication)
  const tag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString("hex"),
    tag: tag.toString("hex"),
  };
}

/**
 * Decrypts encrypted data
 *
 * @param encryptedData - Object with encrypted data, IV, and tag
 * @returns Decrypted data (parsed from JSON)
 *
 * @example
 * ```ts
 * const decrypted = decrypt({
 *   encrypted: row.accessToken,
 *   iv: row.accessTokenIv,
 *   tag: row.accessTokenTag,
 * });
 * // Returns: { apiKey: "secret123" }
 * ```
 */
export function decrypt<T = unknown>(encryptedData: EncryptedData): T {
  const { encrypted, iv, tag } = encryptedData;

  // Convert from hex
  const ivBuffer = Buffer.from(iv, "hex");
  const tagBuffer = Buffer.from(tag, "hex");

  // Get key from env
  const key = Buffer.from(env.ENCRYPTION_KEY, "hex");

  // Create decipher
  const decipher = createDecipheriv(ALGORITHM, key, ivBuffer);
  decipher.setAuthTag(tagBuffer);

  // Decrypt data
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return JSON.parse(decrypted) as T;
}

/**
 * Check if data appears to be encrypted (has valid hex format)
 * Useful for migration scenarios or fallback logic
 *
 * @param data - String to check
 * @returns True if string looks like encrypted hex data
 */
export function isEncrypted(data: string): boolean {
  return /^[0-9a-f]+$/i.test(data) && data.length > 32;
}
