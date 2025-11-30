/**
 * Media upload limits and allowed types
 */

const MB = 1024 * 1024;

export const MEDIA_LIMITS = {
  IMAGE: {
    /** Maximum image file size in bytes (10MB) */
    MAX_SIZE_BYTES: 10 * MB,
    /** Allowed image MIME types */
    ALLOWED_TYPES: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ] as const,
  },

  VIDEO: {
    /** Maximum video file size in bytes (100MB) */
    MAX_SIZE_BYTES: 100 * MB,
    /** Allowed video MIME types */
    ALLOWED_TYPES: [
      "video/mp4",
      "video/webm",
      "video/quicktime",
    ] as const,
  },

  AUDIO: {
    /** Maximum audio file size in bytes (20MB) */
    MAX_SIZE_BYTES: 20 * MB,
    /** Allowed audio MIME types */
    ALLOWED_TYPES: [
      "audio/mpeg",
      "audio/ogg",
      "audio/wav",
      "audio/mp4",
      "audio/aac",
      "audio/webm",
    ] as const,
  },

  DOCUMENT: {
    /** Maximum document file size in bytes (25MB) */
    MAX_SIZE_BYTES: 25 * MB,
    /** Allowed document MIME types */
    ALLOWED_TYPES: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain",
      "text/csv",
    ] as const,
  },
} as const;

/**
 * Helper type to get media type from config key
 */
export type MediaType = keyof typeof MEDIA_LIMITS;

/**
 * Helper type to get allowed MIME types for a media type
 */
export type AllowedMimeType<T extends MediaType> =
  (typeof MEDIA_LIMITS)[T]["ALLOWED_TYPES"][number];

/**
 * Validates if a file meets the requirements for a given media type
 *
 * @param file - The file to validate
 * @param mediaType - The type of media (IMAGE, VIDEO, AUDIO, DOCUMENT)
 * @returns true if file is valid, false otherwise
 *
 * @example
 * ```ts
 * const file = new File(["content"], "image.jpg", { type: "image/jpeg" });
 * const isValid = isValidMediaFile(file, "IMAGE"); // true
 * ```
 */
export function isValidMediaFile(
  file: File,
  mediaType: MediaType,
): boolean {
  const config = MEDIA_LIMITS[mediaType];
  const isValidSize = file.size <= config.MAX_SIZE_BYTES;
  const isValidType = (config.ALLOWED_TYPES as readonly string[]).includes(
    file.type,
  );

  return isValidSize && isValidType;
}

/**
 * Gets the maximum size in MB for a media type
 *
 * @param mediaType - The type of media
 * @returns Maximum size in megabytes
 *
 * @example
 * ```ts
 * getMaxSizeMB("VIDEO"); // 100
 * ```
 */
export function getMaxSizeMB(mediaType: MediaType): number {
  return MEDIA_LIMITS[mediaType].MAX_SIZE_BYTES / MB;
}

/**
 * Formats bytes to human-readable size
 *
 * @param bytes - Size in bytes
 * @returns Formatted string (e.g., "10 MB", "1.5 GB")
 *
 * @example
 * ```ts
 * formatFileSize(1024 * 1024 * 10); // "10 MB"
 * ```
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${Math.round(bytes / Math.pow(k, i))} ${sizes[i]}`;
}

/**
 * Formats duration in seconds to MM:SS format
 *
 * @param seconds - Duration in seconds
 * @returns Formatted string (e.g., "3:45", "12:03")
 *
 * @example
 * ```ts
 * formatDuration(185); // "3:05"
 * formatDuration(62); // "1:02"
 * ```
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
