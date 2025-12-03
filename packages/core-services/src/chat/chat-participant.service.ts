import { chatParticipant, eq, and } from "@manylead/db";
import type { TenantDB } from "@manylead/db";

/**
 * Chat Participant Service
 *
 * Responsabilidades:
 * - Criar/atualizar participants (elimina 180 linhas de duplicação)
 * - Gerenciar unreadCount por participant
 * - Marcar como lido
 *
 * Service stateless - recebe tenantDb no constructor
 */
export class ChatParticipantService {
  constructor(private tenantDb: TenantDB) {}

  /**
   * Criar ou atualizar participant
   *
   * Centraliza lógica repetida em assign, transfer, markAsRead
   *
   * @param chatId - ID do chat
   * @param chatCreatedAt - created_at do chat (parte do composite PK)
   * @param agentId - ID do agent participante
   * @param options - Opções de unreadCount e lastReadAt
   */
  async upsertParticipant(
    chatId: string,
    chatCreatedAt: Date,
    agentId: string,
    options: {
      unreadCount?: number;
      lastReadAt?: Date;
    } = {},
  ): Promise<void> {
    const now = new Date();

    // Verificar se participant já existe
    const [existing] = await this.tenantDb
      .select()
      .from(chatParticipant)
      .where(
        and(
          eq(chatParticipant.chatId, chatId),
          eq(chatParticipant.chatCreatedAt, chatCreatedAt),
          eq(chatParticipant.agentId, agentId),
        ),
      )
      .limit(1);

    if (!existing) {
      // Criar novo participant
      await this.tenantDb.insert(chatParticipant).values({
        chatId,
        chatCreatedAt,
        agentId,
        unreadCount: options.unreadCount ?? 0,
        lastReadAt: options.lastReadAt ?? now,
      });
    } else {
      // Atualizar existente
      await this.tenantDb
        .update(chatParticipant)
        .set({
          unreadCount: options.unreadCount ?? existing.unreadCount,
          lastReadAt: options.lastReadAt ?? existing.lastReadAt,
          updatedAt: now,
        })
        .where(
          and(
            eq(chatParticipant.chatId, chatId),
            eq(chatParticipant.chatCreatedAt, chatCreatedAt),
            eq(chatParticipant.agentId, agentId),
          ),
        );
    }
  }

  /**
   * Marcar chat como lido para agent
   *
   * Apenas atualiza se participant já existir (não cria)
   * Retorna true se conseguiu atualizar, false se participant não existe
   *
   * Usado na procedure markAsRead
   */
  async markAsRead(
    chatId: string,
    chatCreatedAt: Date,
    agentId: string,
  ): Promise<boolean> {
    const now = new Date();
    const result = await this.tenantDb
      .update(chatParticipant)
      .set({
        unreadCount: 0,
        lastReadAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(chatParticipant.chatId, chatId),
          eq(chatParticipant.chatCreatedAt, chatCreatedAt),
          eq(chatParticipant.agentId, agentId),
        ),
      )
      .returning();

    return result.length > 0;
  }

  /**
   * Marcar chat como não lido para agent
   *
   * Usado na procedure markAsUnread
   */
  async markAsUnread(
    chatId: string,
    chatCreatedAt: Date,
    agentId: string,
    unreadCount = 1,
  ): Promise<void> {
    await this.upsertParticipant(chatId, chatCreatedAt, agentId, {
      unreadCount,
    });
  }

  /**
   * Zerar unreadCount ao atribuir chat
   *
   * Usado nas procedures assign e transfer
   */
  async resetUnreadOnAssign(
    chatId: string,
    chatCreatedAt: Date,
    agentId: string,
  ): Promise<void> {
    await this.upsertParticipant(chatId, chatCreatedAt, agentId, {
      unreadCount: 0,
      lastReadAt: new Date(),
    });
  }

  /**
   * Incrementar unreadCount quando nova mensagem chega
   *
   * Usado no WhatsApp message processor quando mensagem do customer chega
   * e o chat está atribuído a algum agent
   */
  async incrementUnreadForAssignedAgent(
    chatId: string,
    chatCreatedAt: Date,
    assignedAgentId: string,
  ): Promise<void> {
    // Buscar participant existente
    const [existing] = await this.tenantDb
      .select()
      .from(chatParticipant)
      .where(
        and(
          eq(chatParticipant.chatId, chatId),
          eq(chatParticipant.chatCreatedAt, chatCreatedAt),
          eq(chatParticipant.agentId, assignedAgentId),
        ),
      )
      .limit(1);

    if (existing) {
      // Incrementar unreadCount do participant existente
      await this.tenantDb
        .update(chatParticipant)
        .set({
          unreadCount: (existing.unreadCount ?? 0) + 1,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(chatParticipant.chatId, chatId),
            eq(chatParticipant.chatCreatedAt, chatCreatedAt),
            eq(chatParticipant.agentId, assignedAgentId),
          ),
        );
    }
    // Se participant não existe, não faz nada (será criado quando o agent abrir o chat)
  }
}
