import {
  and,
  chat,
  db as catalogDb,
  department,
  eq,
  message,
  organization,
  organizationSettings,
} from "@manylead/db";
import type { TenantDB, Chat } from "@manylead/db";

import { getEventPublisher } from "../events";
import type { EventPublisher } from "../events";

/**
 * Tipo do workingHours
 */
export interface WorkingHours {
  enabled: boolean;
  schedule: Record<string, { start: string; end: string; enabled: boolean }>;
}

/**
 * Contexto para mensagens automáticas
 */
export interface AutoMessageContext {
  organizationId: string;
  tenantDb: TenantDB;
}

/**
 * Callback para enviar mensagem via WhatsApp (opcional)
 */
export type SendWhatsAppCallback = (text: string) => Promise<string | null>;

/**
 * Chat Auto Messages Service
 *
 * Responsável por enviar mensagens automáticas:
 * - Welcome message (dentro do horário)
 * - Out of hours message (fora do horário)
 */
export class ChatAutoMessagesService {
  private eventPublisher: EventPublisher;

  constructor(redisUrl: string) {
    this.eventPublisher = getEventPublisher(redisUrl);
  }

  /**
   * Verifica se está dentro do horário de trabalho da organização
   */
  async isWithinWorkingHours(ctx: AutoMessageContext): Promise<boolean> {
    const [settings] = await ctx.tenantDb
      .select({
        workingHours: organizationSettings.workingHours,
        timezone: organizationSettings.timezone,
      })
      .from(organizationSettings)
      .where(eq(organizationSettings.organizationId, ctx.organizationId))
      .limit(1);

    const workingHours = settings?.workingHours as WorkingHours | null;

    if (!workingHours?.enabled) {
      // Se não há horário configurado ou não está habilitado, considera dentro do horário
      return true;
    }

    const timezone = settings?.timezone ?? "America/Sao_Paulo";

    // Obter data/hora atual no timezone da organização
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const parts = formatter.formatToParts(now);
    const weekday = parts.find((p) => p.type === "weekday")?.value.toLowerCase();
    const hour = parts.find((p) => p.type === "hour")?.value;
    const minute = parts.find((p) => p.type === "minute")?.value;

    if (!weekday || !hour || !minute) {
      return true; // Em caso de erro, considera dentro do horário
    }

    const currentTime = `${hour}:${minute}`;
    const daySchedule = workingHours.schedule[weekday];

    if (!daySchedule?.enabled) {
      return false; // Dia não está habilitado
    }

    // Verificar se está dentro do horário
    return currentTime >= daySchedule.start && currentTime <= daySchedule.end;
  }

  /**
   * Formata os horários de trabalho para exibição na mensagem
   */
  formatWorkingHoursDisplay(workingHours: WorkingHours): string {
    const dayOrder = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    const weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday"];
    const weekdaysEnabled = weekdays.filter((day) => workingHours.schedule[day]?.enabled);

    // Se todos os dias da semana (seg-sex) têm o mesmo horário, simplificar
    if (weekdaysEnabled.length === 5) {
      const firstDay = workingHours.schedule.monday;
      const allSame = weekdaysEnabled.every(
        (day) =>
          workingHours.schedule[day]?.start === firstDay?.start &&
          workingHours.schedule[day]?.end === firstDay?.end,
      );

      if (allSame && firstDay) {
        const fmtTime = (time: string) => time.replace(":", "h");
        return `Segunda a sexta-feira, das ${fmtTime(firstDay.start)} às ${fmtTime(firstDay.end)}.`;
      }
    }

    // Caso contrário, listar cada dia habilitado
    const dayNames: Record<string, string> = {
      monday: "Segunda",
      tuesday: "Terça",
      wednesday: "Quarta",
      thursday: "Quinta",
      friday: "Sexta",
      saturday: "Sábado",
      sunday: "Domingo",
    };

    const enabledDays = dayOrder.filter((day) => workingHours.schedule[day]?.enabled);
    const lines = enabledDays.map((day) => {
      const schedule = workingHours.schedule[day];
      if (!schedule) return "";
      const fmtTime = (time: string) => time.replace(":", "h");
      return `${dayNames[day]}: ${fmtTime(schedule.start)} às ${fmtTime(schedule.end)}`;
    });

    return lines.filter(Boolean).join("\n");
  }

  /**
   * Envia welcome message para novo chat
   *
   * @returns A mensagem criada ou null se não enviou
   */
  async sendWelcomeMessage(
    ctx: AutoMessageContext,
    chatRecord: Chat,
    messageSource: "whatsapp" | "internal",
    sendWhatsApp?: SendWhatsAppCallback,
  ): Promise<typeof message.$inferSelect | null> {
    // Buscar settings da organização
    const [settings] = await ctx.tenantDb
      .select({ welcomeMessage: organizationSettings.welcomeMessage })
      .from(organizationSettings)
      .where(eq(organizationSettings.organizationId, ctx.organizationId))
      .limit(1);

    if (!settings?.welcomeMessage) {
      return null;
    }

    const now = new Date();
    let whatsappMessageId: string | null = null;

    // Enviar via WhatsApp se callback fornecido
    if (sendWhatsApp) {
      whatsappMessageId = await sendWhatsApp(settings.welcomeMessage);
      if (!whatsappMessageId) {
        return null; // Falha ao enviar via WhatsApp
      }
    }

    // Salvar mensagem de sistema
    const [newMessage] = await ctx.tenantDb
      .insert(message)
      .values({
        chatId: chatRecord.id,
        messageSource,
        sender: "system",
        senderId: null,
        messageType: "system",
        content: settings.welcomeMessage,
        whatsappMessageId,
        status: "sent",
        sentAt: now,
        timestamp: now,
        metadata: { systemEventType: "welcome_message" },
      })
      .returning();

    // Atualizar lastMessage do chat
    await ctx.tenantDb
      .update(chat)
      .set({
        lastMessageContent: settings.welcomeMessage,
        lastMessageSender: "agent",
        lastMessageAt: now,
        lastMessageType: "system",
        lastMessageStatus: "sent",
      })
      .where(
        and(eq(chat.id, chatRecord.id), eq(chat.createdAt, chatRecord.createdAt)),
      );

    // Emitir evento
    if (newMessage) {
      await this.eventPublisher.messageCreated(
        ctx.organizationId,
        chatRecord.id,
        newMessage,
      );
    }

    return newMessage ?? null;
  }

  /**
   * Envia mensagem de fora do expediente para novo chat
   *
   * @returns A mensagem criada ou null se não enviou
   */
  async sendOutOfHoursMessage(
    ctx: AutoMessageContext,
    chatRecord: Chat,
    messageSource: "whatsapp" | "internal",
    sendWhatsApp?: SendWhatsAppCallback,
  ): Promise<typeof message.$inferSelect | null> {
    // Buscar workingHours
    const [settings] = await ctx.tenantDb
      .select({
        workingHours: organizationSettings.workingHours,
      })
      .from(organizationSettings)
      .where(eq(organizationSettings.organizationId, ctx.organizationId))
      .limit(1);

    const workingHours = settings?.workingHours as WorkingHours | null;

    if (!workingHours?.enabled) {
      return null;
    }

    // Buscar nome da organização
    const [org] = await catalogDb
      .select({ name: organization.name })
      .from(organization)
      .where(eq(organization.id, ctx.organizationId))
      .limit(1);

    // Buscar departamento default
    const [defaultDept] = await ctx.tenantDb
      .select({ name: department.name })
      .from(department)
      .where(
        and(
          eq(department.organizationId, ctx.organizationId),
          eq(department.isDefault, true),
        ),
      )
      .limit(1);

    const orgName = org?.name ?? "nossa empresa";
    const deptName = defaultDept?.name ?? "Atendimento";
    const hoursDisplay = this.formatWorkingHoursDisplay(workingHours);

    const messageContent = `Bem-vindo a ${orgName}!\n\n*Somos do departamento ${deptName}* agradecemos a sua mensagem. Não estamos disponíveis no momento, mas entraremos em contato assim que possível.\n\n*Horário de atendimento*\n${hoursDisplay}`;

    const now = new Date();
    let whatsappMessageId: string | null = null;

    // Enviar via WhatsApp se callback fornecido
    if (sendWhatsApp) {
      whatsappMessageId = await sendWhatsApp(messageContent);
      if (!whatsappMessageId) {
        return null;
      }
    }

    // Salvar mensagem de sistema
    const [newMessage] = await ctx.tenantDb
      .insert(message)
      .values({
        chatId: chatRecord.id,
        messageSource,
        sender: "system",
        senderId: null,
        messageType: "system",
        content: messageContent,
        whatsappMessageId,
        status: "sent",
        sentAt: now,
        timestamp: now,
        metadata: { systemEventType: "out_of_hours_message" },
      })
      .returning();

    // Atualizar lastMessage do chat
    await ctx.tenantDb
      .update(chat)
      .set({
        lastMessageContent: messageContent,
        lastMessageSender: "agent",
        lastMessageAt: now,
        lastMessageType: "system",
        lastMessageStatus: "sent",
      })
      .where(
        and(eq(chat.id, chatRecord.id), eq(chat.createdAt, chatRecord.createdAt)),
      );

    // Emitir evento
    if (newMessage) {
      await this.eventPublisher.messageCreated(
        ctx.organizationId,
        chatRecord.id,
        newMessage,
      );
    }

    return newMessage ?? null;
  }
}

// Singleton
let chatAutoMessagesServiceInstance: ChatAutoMessagesService | null = null;

export function getChatAutoMessagesService(
  redisUrl: string,
): ChatAutoMessagesService {
  chatAutoMessagesServiceInstance ??= new ChatAutoMessagesService(redisUrl);
  return chatAutoMessagesServiceInstance;
}
