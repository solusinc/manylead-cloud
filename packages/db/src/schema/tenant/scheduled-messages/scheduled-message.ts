import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { v7 as uuidv7 } from "uuid";

import type { ScheduledMessageMetadata } from "./constants";

/**
 * Scheduled Message Content Type Enum
 */
export const scheduledContentTypeEnum = pgEnum("scheduled_content_type", [
  "message",
  "comment",
]);

/**
 * Scheduled Message Status Enum
 */
export const scheduledStatusEnum = pgEnum("scheduled_status", [
  "pending",
  "processing",
  "sent",
  "failed",
  "cancelled",
  "expired",
]);

/**
 * Scheduled Messages - Agendamento de Mensagens e Notas
 *
 * Armazena mensagens/notas agendadas para envio futuro
 * Suporta cancelamento automático baseado em eventos do chat
 */
export const scheduledMessage = pgTable(
  "scheduled_message",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),

    organizationId: text("organization_id").notNull(),

    // Relacionamentos
    chatId: uuid("chat_id").notNull(),
    // NOTA: FK não usado devido a composite key do chat (id, created_at)
    chatCreatedAt: timestamp("chat_created_at", { withTimezone: true }).notNull(),

    // Quem criou
    createdByAgentId: uuid("created_by_agent_id").notNull(),

    // Conteúdo
    contentType: scheduledContentTypeEnum("content_type")
      .notNull()
      .default("message"),
    // "message" = mensagem visível ao contato
    // "comment" = nota interna (visibleTo: "agents_only")
    content: text("content").notNull(),

    // Agendamento
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    // Data/hora UTC para envio
    timezone: varchar("timezone", { length: 50 }).notNull(),
    // Timezone da organização (ex: "America/Sao_Paulo")

    // Status
    status: scheduledStatusEnum("status").notNull().default("pending"),

    // Regras de cancelamento automático
    cancelOnContactMessage: boolean("cancel_on_contact_message")
      .notNull()
      .default(false),
    // Se true, cancela quando contato enviar nova mensagem
    cancelOnAgentMessage: boolean("cancel_on_agent_message")
      .notNull()
      .default(false),
    // Se true, cancela quando agente enviar nova mensagem
    cancelOnChatClose: boolean("cancel_on_chat_close")
      .notNull()
      .default(false),
    // Se true, cancela quando chat for fechado

    // Metadata (histórico de ações)
    metadata: jsonb("metadata")
      .$type<ScheduledMessageMetadata>()
      .notNull()
      .default({ history: [] }),

    // Job tracking
    jobId: varchar("job_id", { length: 255 }),
    // ID do job no BullMQ para poder cancelar

    // Resultado
    sentAt: timestamp("sent_at", { withTimezone: true }),
    sentMessageId: uuid("sent_message_id"),
    // ID da mensagem criada após envio
    errorMessage: text("error_message"),
    retryCount: integer("retry_count").notNull().default(0),

    // Cancelamento
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledByAgentId: uuid("cancelled_by_agent_id"),
    cancellationReason: varchar("cancellation_reason", { length: 100 }),
    // "manual" | "contact_message" | "agent_message" | "chat_closed"

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Buscar agendamentos pendentes por horário (worker)
    index("scheduled_message_pending_idx").on(table.scheduledAt, table.status),

    // Buscar por chat (UI)
    index("scheduled_message_chat_idx").on(table.chatId, table.chatCreatedAt, table.status),

    // Buscar por organização (página global futura)
    index("scheduled_message_org_idx").on(table.organizationId, table.status, table.scheduledAt),

    // Buscar por job ID
    index("scheduled_message_job_idx").on(table.jobId),
  ],
);
