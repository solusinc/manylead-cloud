import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { v7 as uuidv7 } from "uuid";

/**
 * Organization Settings table - Configurações gerais da organização
 *
 * Armazena configurações como timezone padrão, horário de funcionamento,
 * mensagens automáticas e preferências de privacidade
 */
export const organizationSettings = pgTable(
  "organization_settings",
  {
    id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),

    organizationId: text("organization_id").notNull().unique(),
    // Referência ao organization.id do catalog DB (Better Auth)
    // Não pode usar FK pois está em outro database
    // UNIQUE porque só pode ter um settings por organização

    // Timezone padrão da organização
    timezone: text("timezone").notNull().default("America/Sao_Paulo"),
    // Ex: "America/Sao_Paulo", "America/New_York", "Europe/London"

    // Horário de funcionamento (SEM timezone próprio, usa o timezone acima)
    workingHours: jsonb("working_hours").$type<{
      enabled: boolean;
      schedule: Record<
        string,
        { start: string; end: string; enabled: boolean }
      >;
      // Ex: { monday: { start: "09:00", end: "18:00", enabled: true } }
    }>(),

    // Mensagens automáticas
    welcomeMessage: text("welcome_message"),
    // Mensagem de boas vindas enviada ao iniciar conversa

    closingMessage: text("closing_message"),
    // Mensagem de finalização enviada ao encerrar atendimento

    // Avaliação de atendimento
    ratingEnabled: boolean("rating_enabled").default(false).notNull(),
    // Se true, envia mensagem pedindo nota de 1 a 5 após finalizar

    // Privacidade e configurações
    includeUserName: boolean("include_user_name").default(false).notNull(),
    // Se true, mensagens incluem o nome do usuário

    hidePhoneDigits: boolean("hide_phone_digits").default(false).notNull(),
    // Se true, oculta últimos 4 dígitos do telefone (ex: +55 11 98765-XXXX)

    // Chat Assignment Rules (auto-atribuição de conversas)
    chatAssignmentRules: jsonb("chat_assignment_rules").$type<
      {
        enabled: boolean;
        strategy: "round_robin" | "sticky" | "availability" | "manual";
        departmentId?: string; // Aplicar apenas para este departamento
        priority?: number; // Ordem de aplicação (menor = primeiro)
      }[]
    >(),

    // Bright Data Proxy Settings (Evolution API apenas)
    proxySettings: jsonb("proxy_settings")
      .$type<{
        enabled: boolean;
        country?: "br" | "us" | "ar" | "cl" | "mx" | "co" | "pe" | "pt" | "es";
        sessionId?: string;
        lastKeepAliveAt?: string;
        rotationCount?: number;
        lastRotatedAt?: string;
      }>()
      .default({ enabled: true }),
    // Proxy habilitado por padrão com country auto-detectado por timezone
    // ⚠️ Aplicado APENAS para Evolution API (QR_CODE), NÃO para WhatsApp Business API

    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("organization_settings_org_idx").on(table.organizationId),
  ],
);
