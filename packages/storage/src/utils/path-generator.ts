import { customAlphabet } from "nanoid";
import path from "node:path";

// nanoid com alfabeto seguro para URLs
const nanoid = customAlphabet(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  21,
);

export type MediaType = "image" | "video" | "audio" | "document";

/**
 * Gera um caminho único para armazenar mídia no R2
 * Formato: {organizationId}/{year}/{month}/media/{nanoid}{ext}
 * Exemplo: org_123/2025/01/media/x7k2n9p4q1r8s5t6u9v2w.jpg
 */
export function generateMediaPath(
  organizationId: string,
  fileName: string,
): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const id = nanoid();
  const ext = path.extname(fileName);

  return `${organizationId}/${year}/${month}/media/${id}${ext}`;
}

/**
 * Determina o tipo de mídia baseado no MIME type
 */
export function getMediaTypeFromMimeType(mimeType: string): MediaType {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return "document";
}

/**
 * Retorna as tags do R2 para aplicar lifecycle policies
 * Baseado no tipo de mídia
 */
export function getR2TagsForMedia(mediaType: MediaType): Record<string, string> {
  return {
    type: mediaType,
  };
}
