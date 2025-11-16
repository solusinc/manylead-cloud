import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { v7 as uuidv7 } from "uuid";

/**
 * Attachments - Anexos/Mídia
 *
 * Armazena metadados de arquivos enviados/recebidos via WhatsApp
 * Arquivos reais ficam no Cloudflare R2
 */
export const attachment = pgTable(
  "attachment",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),

    messageId: uuid("message_id").notNull(),
    // NOTA: FK removido porque message tem PK composto (id, timestamp)
    // FK será validado na aplicação

    // Tipo de mídia
    mediaType: varchar("media_type", { length: 20 }).notNull(),
    // "image" | "video" | "audio" | "document"

    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    // Ex: "image/jpeg", "video/mp4", "application/pdf"

    // WhatsApp Media ID (do Meta Graph API)
    whatsappMediaId: varchar("whatsapp_media_id", { length: 255 }),

    // Storage (Cloudflare R2)
    storagePath: text("storage_path").notNull(),
    // Ex: {orgId}/2025/01/media/{uuid}.jpg

    storageUrl: text("storage_url"),
    // URL pública do arquivo no R2

    // Metadata do arquivo
    fileName: varchar("file_name", { length: 255 }).notNull(),
    fileSize: integer("file_size"),
    // Tamanho em bytes

    // Dimensões (para imagens/vídeos)
    width: integer("width"),
    height: integer("height"),

    // Duração (para vídeos/áudios)
    duration: integer("duration"),
    // Em segundos

    // Status do download
    downloadStatus: varchar("download_status", { length: 20 })
      .notNull()
      .default("pending"),
    // "pending" | "downloading" | "completed" | "failed"

    downloadError: text("download_error"),
    downloadedAt: timestamp("downloaded_at"),

    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    // Index para buscar attachments por mensagem
    index("attachment_message_idx").on(table.messageId),

    // Index para buscar attachments pendentes de download (retry queue)
    index("attachment_download_status_idx").on(
      table.downloadStatus,
      table.createdAt.asc(),
    ),

    // Index para buscar attachments por tipo de mídia
    index("attachment_media_type_idx").on(
      table.mediaType,
      table.createdAt.desc(),
    ),
  ],
);
