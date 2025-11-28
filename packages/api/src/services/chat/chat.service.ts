import { chat, message, agent, user, department, ending, eq, and, asc, sql } from "@manylead/db";
import type { TenantDB, Chat } from "@manylead/db";
import { TRPCError } from "@trpc/server";
import { formatTime, formatDateTime, calculateDuration } from "@manylead/shared";

import { getEventPublisher } from "../events";
import type { EventPublisher } from "../events";
import { ChatParticipantService } from "./chat-participant.service";
import type {
  ChatServiceConfig,
  ChatContext,
  CloseChatInput,
  AssignChatInput,
  TransferChatInput,
} from "./chat.types";

/**
 * Chat Service
 *
 * Responsabilidades:
 * - CRUD básico de chats
 * - Operações de atualização (status, assignment)
 * - Publicação de eventos
 *
 * Fase 2: CRUD Básico
 * - getById, update
 * - close, reopen
 * - updateLastMessage helper
 *
 * Fase 3 (próxima): Operações complexas
 * - assign, transfer
 * - System messages
 */
export class ChatService {
  private eventPublisher: EventPublisher;
  private getTenantConnection: (orgId: string) => Promise<TenantDB>;
  private getCatalogDb: () => unknown;

  constructor(config: ChatServiceConfig) {
    this.eventPublisher = getEventPublisher(config.redisUrl);
    this.getTenantConnection = config.getTenantConnection;
    this.getCatalogDb = config.getCatalogDb;
  }

  /**
   * Buscar chat por ID (composite key)
   *
   * @throws {TRPCError} NOT_FOUND se chat não encontrado
   */
  async getById(
    ctx: ChatContext,
    id: string,
    createdAt: Date,
  ): Promise<Chat> {
    const [chatRecord] = await ctx.tenantDb
      .select()
      .from(chat)
      .where(and(eq(chat.id, id), eq(chat.createdAt, createdAt)))
      .limit(1);

    if (!chatRecord) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Chat não encontrado",
      });
    }

    return chatRecord;
  }

  /**
   * Atualizar chat
   *
   * Atualiza campos do chat e publica evento
   *
   * @throws {TRPCError} NOT_FOUND se chat não encontrado
   */
  async update(
    ctx: ChatContext,
    id: string,
    createdAt: Date,
    data: Partial<Chat>,
  ): Promise<Chat> {
    const [updated] = await ctx.tenantDb
      .update(chat)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(chat.id, id), eq(chat.createdAt, createdAt)))
      .returning();

    if (!updated) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Chat não encontrado",
      });
    }

    // Publicar evento de atualização
    await this.eventPublisher.chatUpdated(ctx.organizationId, updated);

    return updated;
  }

  /**
   * Fechar chat com ending e gerar protocolo completo
   *
   * Fase 3: Versão completa com system message detalhada
   * - Busca informações de agent, departamento, ending
   * - Calcula duração desde primeira mensagem
   * - Gera protocolo formatado
   */
  async close(ctx: ChatContext, input: CloseChatInput): Promise<Chat> {
    // 1. Buscar chat atual
    const currentChat = await this.getById(ctx, input.id, input.createdAt);

    // 2. Buscar informações do agent
    const [currentAgent] = await ctx.tenantDb
      .select()
      .from(agent)
      .where(eq(agent.id, ctx.agentId))
      .limit(1);

    if (!currentAgent) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Agent não encontrado",
      });
    }

    const catalogDb = this.getCatalogDb() as TenantDB;
    const [agentUser] = await catalogDb
      .select()
      .from(user)
      .where(eq(user.id, currentAgent.userId))
      .limit(1);

    const agentName = agentUser?.name ?? "Agente";

    // 3. Buscar departamento (se houver)
    let departmentName = "";
    if (currentChat.departmentId) {
      const [deptData] = await ctx.tenantDb
        .select()
        .from(department)
        .where(eq(department.id, currentChat.departmentId))
        .limit(1);

      departmentName = deptData?.name ?? "";
    }

    // 4. Buscar motivo de finalização (se houver)
    let endingName = "";
    if (input.endingId) {
      const [endingData] = await ctx.tenantDb
        .select()
        .from(ending)
        .where(eq(ending.id, input.endingId))
        .limit(1);

      endingName = endingData?.title ?? "";
    }

    // 5. Buscar primeira mensagem não-sistema para calcular "Atendido em"
    const [firstMessage] = await ctx.tenantDb
      .select()
      .from(message)
      .where(
        and(
          eq(message.chatId, input.id),
          sql`${message.sender} != 'system'`,
        ),
      )
      .orderBy(asc(message.timestamp))
      .limit(1);

    // 6. Fechar o chat
    const closedAt = new Date();
    const [updated] = await ctx.tenantDb
      .update(chat)
      .set({
        status: "closed",
        endingId: input.endingId ?? null,
        updatedAt: closedAt,
      })
      .where(and(eq(chat.id, input.id), eq(chat.createdAt, input.createdAt)))
      .returning();

    if (!updated) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Chat não encontrado",
      });
    }

    // 7. Calcular duração
    const attendedAt = firstMessage?.timestamp ?? currentChat.createdAt;
    const duration = calculateDuration(new Date(attendedAt), closedAt);

    // 8. Gerar mensagem de sistema com protocolo
    const systemMessageContent = `Protocolo: ${currentChat.id}
Usuário: ${agentName}
Departamento: ${departmentName || "-"}
Motivo: ${endingName || "-"}
Iniciado em: ${formatDateTime(currentChat.createdAt)}
Atendido em: ${formatDateTime(new Date(attendedAt))}
Finalizado em: ${formatDateTime(closedAt)}
Duração: ${duration}`;

    await this.createSystemMessage(ctx, updated, {
      content: systemMessageContent,
      systemEventType: "session_closed",
      metadata: {
        agentId: ctx.agentId,
        agentName,
        protocol: currentChat.id,
        departmentName,
        endingId: input.endingId,
        endingName,
        startedAt: currentChat.createdAt.toISOString(),
        attendedAt: new Date(attendedAt).toISOString(),
        closedAt: closedAt.toISOString(),
        duration,
      },
    });

    // 9. Publicar evento
    await this.eventPublisher.chatUpdated(ctx.organizationId, updated);

    return updated;
  }

  /**
   * Reabrir chat
   *
   * Remove status closed e limpa ending
   */
  async reopen(
    ctx: ChatContext,
    id: string,
    createdAt: Date,
  ): Promise<Chat> {
    const [updated] = await ctx.tenantDb
      .update(chat)
      .set({
        status: "open",
        endingId: null,
        updatedAt: new Date(),
      })
      .where(and(eq(chat.id, id), eq(chat.createdAt, createdAt)))
      .returning();

    if (!updated) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Chat não encontrado",
      });
    }

    // Publicar evento de atualização
    await this.eventPublisher.chatUpdated(ctx.organizationId, updated);

    return updated;
  }

  /**
   * Atribuir chat a um agent (action "Atender")
   *
   * Fase 3: Versão completa com system message e participant
   */
  async assign(ctx: ChatContext, input: AssignChatInput): Promise<Chat> {
    // 1. Verificar se agent existe
    const [agentExists] = await ctx.tenantDb
      .select()
      .from(agent)
      .where(eq(agent.id, input.agentId))
      .limit(1);

    if (!agentExists) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Agent não encontrado",
      });
    }

    // 2. Atribuir chat ao agent (NÃO altera departmentId)
    const [updated] = await ctx.tenantDb
      .update(chat)
      .set({
        assignedTo: input.agentId,
        status: "open",
        updatedAt: new Date(),
      })
      .where(and(eq(chat.id, input.id), eq(chat.createdAt, input.createdAt)))
      .returning();

    if (!updated) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Chat não encontrado",
      });
    }

    // 3. Buscar nome do agent para system message
    const catalogDb = this.getCatalogDb() as TenantDB;
    const [agentUser] = await catalogDb
      .select()
      .from(user)
      .where(eq(user.id, agentExists.userId))
      .limit(1);

    const agentName = agentUser?.name ?? "Agente";
    const assignTime = formatTime(updated.updatedAt);

    // 4. Criar system message
    await this.createSystemMessage(ctx, updated, {
      content: `Sessão transferida para ${agentName} às ${assignTime}`,
      systemEventType: "session_assigned",
      metadata: {
        agentId: agentExists.id,
        agentName,
      },
    });

    // 5. Atualizar lastMessage
    await this.updateLastMessage(
      ctx,
      updated.id,
      updated.createdAt,
      "Sessão transferida",
      "system",
    );

    // 6. Zerar unreadCount do chat
    await ctx.tenantDb
      .update(chat)
      .set({ unreadCount: 0 })
      .where(and(eq(chat.id, updated.id), eq(chat.createdAt, updated.createdAt)));

    // 7. Criar/atualizar participant
    const participantService = new ChatParticipantService(ctx.tenantDb);
    await participantService.resetUnreadOnAssign(
      updated.id,
      updated.createdAt,
      input.agentId,
    );

    // 8. Publicar evento
    await this.eventPublisher.chatUpdated(ctx.organizationId, updated);

    return updated;
  }

  /**
   * Transferir chat para outro agent ou departamento
   *
   * Fase 3: Implementa os dois casos:
   * - Transfer para agent: atribui + ajusta departmentId
   * - Transfer para department: remove assignedTo + seta status pending
   */
  async transfer(ctx: ChatContext, input: TransferChatInput): Promise<Chat> {
    // Caso 1: Transferir para agent
    if (input.toAgentId) {
      return this.transferToAgent(ctx, input);
    }

    // Caso 2: Transferir para departamento
    if (input.toDepartmentId) {
      return this.transferToDepartment(ctx, input);
    }

    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Deve especificar toAgentId ou toDepartmentId",
    });
  }

  /**
   * Atualizar lastMessage metadata
   *
   * Helper usado após criar mensagens
   */
  async updateLastMessage(
    ctx: ChatContext,
    id: string,
    createdAt: Date,
    content: string,
    sender: "agent" | "customer" | "system",
  ): Promise<void> {
    await ctx.tenantDb
      .update(chat)
      .set({
        lastMessageAt: new Date(),
        lastMessageContent: content,
        lastMessageSender: sender,
        updatedAt: new Date(),
      })
      .where(and(eq(chat.id, id), eq(chat.createdAt, createdAt)));
  }

  /**
   * Helper privado: Transferir para agent
   */
  private async transferToAgent(
    ctx: ChatContext,
    input: TransferChatInput,
  ): Promise<Chat> {
    if (!input.toAgentId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "toAgentId é obrigatório",
      });
    }

    const targetAgentId = input.toAgentId;

    // 1. Verificar se agent existe
    const [agentExists] = await ctx.tenantDb
      .select()
      .from(agent)
      .where(eq(agent.id, targetAgentId))
      .limit(1);

    if (!agentExists) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Agent não encontrado",
      });
    }

    // 2. Determinar departmentId baseado nas permissões do agent
    let chatDepartmentId: string | null = null;
    if (
      agentExists.permissions.departments.type === "specific" &&
      agentExists.permissions.departments.ids &&
      agentExists.permissions.departments.ids.length > 0
    ) {
      chatDepartmentId = agentExists.permissions.departments.ids[0] ?? null;
    }

    // 3. Atualizar chat (sem modificar unreadCount)
    const [updated] = await ctx.tenantDb
      .update(chat)
      .set({
        assignedTo: targetAgentId,
        departmentId: chatDepartmentId,
        status: "open",
        updatedAt: new Date(),
      })
      .where(and(eq(chat.id, input.id), eq(chat.createdAt, input.createdAt)))
      .returning();

    if (!updated) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Chat não encontrado",
      });
    }

    // 4. Criar/atualizar participant do novo agente preservando unreadCount
    const participantService = new ChatParticipantService(ctx.tenantDb);
    await participantService.upsertParticipant(
      updated.id,
      updated.createdAt,
      targetAgentId,
      {
        unreadCount: updated.unreadCount, // Preservar o unreadCount do chat
        lastReadAt: undefined, // Novo agente ainda não leu
      },
    );

    // 5. Buscar nomes dos agents (from/to)
    const catalogDb = this.getCatalogDb() as TenantDB;
    const [fromAgent] = await ctx.tenantDb
      .select()
      .from(agent)
      .where(eq(agent.id, ctx.agentId))
      .limit(1);

    const [fromUser] = await catalogDb
      .select()
      .from(user)
      .where(eq(user.id, fromAgent?.userId ?? ""))
      .limit(1);

    const [toUser] = await catalogDb
      .select()
      .from(user)
      .where(eq(user.id, agentExists.userId))
      .limit(1);

    const fromName = fromUser?.name ?? "Agente";
    const toName = toUser?.name ?? "Agente";
    const transferTime = formatTime(updated.updatedAt);

    // 6. Criar system message
    await this.createSystemMessage(ctx, updated, {
      content: `Sessão transferida de ${fromName} para ${toName} às ${transferTime}`,
      systemEventType: "session_transferred",
      metadata: {
        fromAgentId: ctx.agentId,
        fromAgentName: fromName,
        toAgentId: agentExists.id,
        toAgentName: toName,
      },
    });

    // 7. Atualizar lastMessage
    await this.updateLastMessage(
      ctx,
      updated.id,
      updated.createdAt,
      "Sessão transferida",
      "system",
    );

    // 8. Publicar evento
    await this.eventPublisher.chatUpdated(ctx.organizationId, updated);

    return updated;
  }

  /**
   * Helper privado: Transferir para departamento
   */
  private async transferToDepartment(
    ctx: ChatContext,
    input: TransferChatInput,
  ): Promise<Chat> {
    if (!input.toDepartmentId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "toDepartmentId é obrigatório",
      });
    }

    const [updated] = await ctx.tenantDb
      .update(chat)
      .set({
        assignedTo: null,
        departmentId: input.toDepartmentId,
        status: "pending",
        updatedAt: new Date(),
      })
      .where(and(eq(chat.id, input.id), eq(chat.createdAt, input.createdAt)))
      .returning();

    if (!updated) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Chat não encontrado",
      });
    }

    // Atualizar lastMessage
    await this.updateLastMessage(
      ctx,
      updated.id,
      updated.createdAt,
      "Sessão transferida",
      "system",
    );

    // Publicar evento
    await this.eventPublisher.chatUpdated(ctx.organizationId, updated);

    return updated;
  }

  /**
   * Helper privado: Criar system message
   */
  private async createSystemMessage(
    ctx: ChatContext,
    chatRecord: Chat,
    options: {
      content: string;
      systemEventType: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<void> {
    await ctx.tenantDb.insert(message).values({
      chatId: chatRecord.id,
      messageSource: chatRecord.messageSource,
      sender: "system",
      senderId: null,
      messageType: "system",
      content: options.content,
      status: "sent",
      timestamp: chatRecord.updatedAt,
      metadata: {
        systemEventType: options.systemEventType,
        ...options.metadata,
      },
    });
  }
}

// Singleton instance
let chatServiceInstance: ChatService | null = null;

/**
 * Get or create ChatService singleton
 */
export function getChatService(config: ChatServiceConfig): ChatService {
  chatServiceInstance ??= new ChatService(config);
  return chatServiceInstance;
}
