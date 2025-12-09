import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  agent,
  channel,
  chat,
  contact,
  count,
  desc,
  eq,
  ilike,
  inArray,
  or,
  user,
} from "@manylead/db";
import { publishChatEvent } from "@manylead/shared";
import { EvolutionAPIClient } from "@manylead/evolution-api-client";

import { env } from "../env";
import {
  adminProcedure,
  createTRPCRouter,
  memberProcedure,
  protectedProcedure,
  tenantManager,
} from "../trpc";

/**
 * Contacts Router
 *
 * Gerencia contatos (WhatsApp contacts) do tenant
 */
export const contactsRouter = createTRPCRouter({
  /**
   * Listar contatos com paginação e busca
   */
  list: memberProcedure
    .input(
      z.object({
        search: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { search, limit, offset } = input;

      // Construir where clause para busca
      const where = search
        ? or(
            ilike(contact.name, `%${search}%`),
            ilike(contact.phoneNumber, `%${search}%`),
            ilike(contact.email, `%${search}%`),
          )
        : undefined;

      // Executar queries em paralelo
      const [items, totalResult] = await Promise.all([
        ctx.tenantDb
          .select()
          .from(contact)
          .where(where)
          .limit(limit)
          .offset(offset)
          .orderBy(desc(contact.createdAt)),
        ctx.tenantDb.select({ count: count() }).from(contact).where(where),
      ]);

      return {
        items,
        total: totalResult[0]?.count ?? 0,
        limit,
        offset,
      };
    }),

  /**
   * Buscar contato por ID
   */
  getById: memberProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [contactRecord] = await ctx.tenantDb
        .select()
        .from(contact)
        .where(eq(contact.id, input.id))
        .limit(1);

      if (!contactRecord) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Contato não encontrado",
        });
      }

      return contactRecord;
    }),

  /**
   * Buscar ou criar contato por número de telefone
   * Usado internamente pelos webhooks para garantir que o contato existe
   */
  findOrCreate: memberProcedure
    .input(
      z.object({
        phoneNumber: z.string().min(1),
        name: z.string().optional(),
        avatar: z.string().url().optional(),
        whatsappProfileName: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Tentar encontrar contato existente
      const [existing] = await ctx.tenantDb
        .select()
        .from(contact)
        .where(eq(contact.phoneNumber, input.phoneNumber))
        .limit(1);

      if (existing) {
        // Atualizar se temos novos dados
        if (input.name || input.avatar || input.whatsappProfileName) {
          const existingMetadata = existing.metadata ?? {
            source: "whatsapp" as const,
          };

          const [updated] = await ctx.tenantDb
            .update(contact)
            .set({
              name: input.name ?? existing.name,
              avatar: input.avatar ?? existing.avatar,
              metadata: {
                source: existingMetadata.source,
                firstMessageAt: existingMetadata.firstMessageAt,
                lastMessageAt: existingMetadata.lastMessageAt,
                whatsappProfileName:
                  input.whatsappProfileName ??
                  existingMetadata.whatsappProfileName,
              },
              updatedAt: new Date(),
            })
            .where(eq(contact.id, existing.id))
            .returning();

          if (!updated) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Falha ao atualizar contato",
            });
          }

          return updated;
        }

        return existing;
      }

      // Criar novo contato (drizzle gera o ID automaticamente)
      const organizationId = ctx.session.session.activeOrganizationId;
      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nenhuma organização ativa",
        });
      }

      const [newContact] = await ctx.tenantDb
        .insert(contact)
        .values({
          organizationId,
          phoneNumber: input.phoneNumber,
          name: input.name ?? input.phoneNumber,
          avatar: input.avatar,
          metadata: {
            source: "whatsapp" as const,
            firstMessageAt: new Date(),
            whatsappProfileName: input.whatsappProfileName,
          },
        })
        .returning();

      if (!newContact) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Falha ao criar contato",
        });
      }

      return newContact;
    }),

  /**
   * Buscar ou criar contato interno a partir de um agent
   * Usado para comunicação interna ManyLead-to-ManyLead
   */
  findOrCreateInternal: protectedProcedure
    .input(
      z.object({
        agentId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.session.session.activeOrganizationId;

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nenhuma organização ativa",
        });
      }

      // Buscar agent para pegar userId
      const tenantDb = await tenantManager.getConnection(organizationId);

      const [agentRecord] = await tenantDb
        .select()
        .from(agent)
        .where(eq(agent.id, input.agentId))
        .limit(1);

      if (!agentRecord) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Agent não encontrado",
        });
      }

      // Buscar user para pegar nome e avatar
      const [userData] = await ctx.db
        .select()
        .from(user)
        .where(eq(user.id, agentRecord.userId))
        .limit(1);

      if (!userData) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Usuário não encontrado",
        });
      }

      // Verificar se já existe um contact para este agent
      // Usar JSONB query para buscar por metadata.agentId
      const existingContacts = await tenantDb
        .select()
        .from(contact)
        .where(eq(contact.organizationId, organizationId));

      const existing = existingContacts.find(
        (c) => c.metadata?.agentId === input.agentId,
      );

      if (existing) {
        return existing;
      }

      // Criar novo contato interno
      const [newContact] = await tenantDb
        .insert(contact)
        .values({
          organizationId,
          phoneNumber: null, // Contatos internos não têm telefone
          name: userData.name,
          avatar: userData.image ?? undefined,
          metadata: {
            source: "internal" as const,
            agentId: input.agentId,
            firstMessageAt: new Date(),
          },
        })
        .returning();

      if (!newContact) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Falha ao criar contato interno",
        });
      }

      return newContact;
    }),

  /**
   * Atualizar contato
   */
  update: memberProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().optional(),
        email: z.string().email().optional(),
        avatar: z.string().url().optional(),
        customName: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
        customFields: z.record(z.string(), z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const organizationId = ctx.session.session.activeOrganizationId;
      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nenhuma organização ativa",
        });
      }

      const [updated] = await ctx.tenantDb
        .update(contact)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(contact.id, id))
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Contato não encontrado",
        });
      }

      // Buscar todos os chats que usam esse contato
      const affectedChats = await ctx.tenantDb
        .select()
        .from(chat)
        .where(eq(chat.contactId, id));

      // Emitir evento chat:updated para cada chat afetado
      // Isso vai fazer o frontend invalidar as queries e refetch
      await Promise.all(
        affectedChats.map((chatRecord) =>
          publishChatEvent(
            {
              type: "chat:updated",
              organizationId,
              chatId: chatRecord.id,
              data: {
                chat: chatRecord as unknown as Record<string, unknown>,
                contact: updated as unknown as Record<string, unknown>,
              },
            },
            env.REDIS_URL,
          ),
        ),
      );

      return updated;
    }),

  /**
   * Deletar contato
   */
  delete: memberProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.tenantDb
        .delete(contact)
        .where(eq(contact.id, input.id))
        .returning();

      if (!deleted) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Contato não encontrado",
        });
      }

      return { success: true };
    }),

  /**
   * Importar contatos em massa
   * Somente admins e owners podem importar
   *
   * Regras:
   * - Telefone obrigatório no formato +5511988884444
   * - Nome obrigatório
   * - Colunas extras viram customFields (JSONB)
   * - Limite: 2.000 contatos por vez
   * - overwrite: se true, atualiza contatos existentes
   */
  importContacts: adminProcedure
    .input(
      z.object({
        contacts: z
          .array(
            z.object({
              phoneNumber: z
                .string()
                .regex(
                  /^\+\d{10,15}$/,
                  "Formato inválido. Use +5511988884444",
                ),
              name: z.string().min(1, "Nome é obrigatório"),
              customFields: z.record(z.string(), z.string()).optional(),
            }),
          )
          .min(1, "Pelo menos um contato é necessário")
          .max(2000, "Limite de 2.000 contatos por importação"),
        overwrite: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.session.session.activeOrganizationId;
      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nenhuma organização ativa",
        });
      }

      // Buscar contatos existentes para verificar duplicados
      const existingContacts = await ctx.tenantDb
        .select({ id: contact.id, phoneNumber: contact.phoneNumber })
        .from(contact)
        .where(eq(contact.organizationId, organizationId));

      const existingPhoneMap = new Map(
        existingContacts
          .filter((c) => c.phoneNumber)
          .map((c) => [c.phoneNumber, c.id]),
      );

      // Separar contatos novos e existentes
      const contactsToInsert: typeof input.contacts = [];
      const contactsToUpdate: (typeof input.contacts[0] & { id: string })[] =
        [];
      const seenPhones = new Set<string>();

      for (const c of input.contacts) {
        // Ignorar duplicados dentro do próprio input
        if (seenPhones.has(c.phoneNumber)) {
          continue;
        }
        seenPhones.add(c.phoneNumber);

        const existingId = existingPhoneMap.get(c.phoneNumber);
        if (existingId) {
          if (input.overwrite) {
            contactsToUpdate.push({ ...c, id: existingId });
          }
          // Se não for overwrite, simplesmente ignora
        } else {
          contactsToInsert.push(c);
        }
      }

      // Inserir novos contatos
      if (contactsToInsert.length > 0) {
        const values = contactsToInsert.map((c) => ({
          organizationId,
          phoneNumber: c.phoneNumber,
          name: c.name,
          customFields: c.customFields ?? null,
          metadata: {
            source: "manual" as const,
            firstMessageAt: new Date(),
          },
        }));

        await ctx.tenantDb.insert(contact).values(values);
      }

      // Atualizar contatos existentes (se overwrite = true)
      if (contactsToUpdate.length > 0) {
        for (const c of contactsToUpdate) {
          await ctx.tenantDb
            .update(contact)
            .set({
              name: c.name,
              customFields: c.customFields ?? null,
              updatedAt: new Date(),
            })
            .where(eq(contact.id, c.id));
        }
      }

      return {
        imported: contactsToInsert.length,
        updated: contactsToUpdate.length,
        skipped:
          input.contacts.length -
          contactsToInsert.length -
          contactsToUpdate.length,
        total: input.contacts.length,
      };
    }),

  /**
   * Buscar participantes de um grupo WhatsApp
   * Retorna lista de participantes com nome, telefone e role (admin/member)
   */
  getGroupParticipants: memberProcedure
    .input(
      z.object({
        contactId: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.session.session.activeOrganizationId;
      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nenhuma organização ativa",
        });
      }

      // Buscar o contato (grupo) pelo ID
      const [groupContact] = await ctx.tenantDb
        .select()
        .from(contact)
        .where(eq(contact.id, input.contactId))
        .limit(1);

      if (!groupContact) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Contato não encontrado",
        });
      }

      if (!groupContact.isGroup || !groupContact.groupJid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Contato não é um grupo",
        });
      }

      // Buscar canal conectado para obter instanceName
      const [connectedChannel] = await ctx.tenantDb
        .select()
        .from(channel)
        .where(eq(channel.status, "connected"))
        .limit(1);

      if (!connectedChannel?.evolutionInstanceName) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Nenhum canal WhatsApp conectado",
        });
      }

      // Buscar info do grupo na Evolution API
      const evolutionClient = new EvolutionAPIClient(
        env.EVOLUTION_API_URL,
        env.EVOLUTION_API_KEY,
      );

      // O groupJid pode estar com @g.us ou não, a API precisa com @g.us
      const groupJid = groupContact.groupJid.includes("@g.us")
        ? groupContact.groupJid
        : `${groupContact.groupJid}@g.us`;

      const groupInfo = await evolutionClient.group.findGroupInfos(
        connectedChannel.evolutionInstanceName,
        groupJid,
      );

      if (!groupInfo) {
        return {
          participants: [],
          total: 0,
        };
      }

      // Buscar contatos existentes para os participantes (pelo phoneNumber)
      // Evolution API retorna phoneNumber como JID (ex: "5511999999999@s.whatsapp.net")
      // Banco armazena sem @s.whatsapp.net e sem +, ex: "5511999999999"
      const participantPhones = (groupInfo.participants ?? []).flatMap((p) => {
        // Remove sufixo @s.whatsapp.net se existir
        const phone = p.phoneNumber.replace(/@s\.whatsapp\.net$/, "");
        // Gera variações: com + e sem +
        if (phone.startsWith("+")) {
          return [phone, phone.slice(1)];
        }
        return [phone, `+${phone}`];
      });

      const existingContacts = participantPhones.length > 0
        ? await ctx.tenantDb
            .select({
              phoneNumber: contact.phoneNumber,
              customName: contact.customName,
              name: contact.name,
              avatar: contact.avatar,
            })
            .from(contact)
            .where(inArray(contact.phoneNumber, participantPhones))
        : [];

      // Criar map de telefone -> contato para lookup rápido
      // Normaliza removendo o + para comparação
      const contactMap = new Map<string, (typeof existingContacts)[number]>();
      for (const c of existingContacts) {
        if (c.phoneNumber) {
          const normalizedPhone = c.phoneNumber.replace(/^\+/, "");
          contactMap.set(normalizedPhone, c);
        }
      }

      // Número do canal conectado (normalizado)
      const channelPhone = connectedChannel.phoneNumber
        ?.replace(/@s\.whatsapp\.net$/, "")
        .replace(/^\+/, "") ?? "";

      // Mapear participantes para formato amigável com nome do contato se existir
      const participants = (groupInfo.participants ?? []).map((p) => {
        // Normaliza o telefone do participante para lookup
        // Remove @s.whatsapp.net e +
        const normalizedPhone = p.phoneNumber
          .replace(/@s\.whatsapp\.net$/, "")
          .replace(/^\+/, "");
        const existingContact = contactMap.get(normalizedPhone);
        // Se tem contato e o nome é diferente do telefone, usa o nome do contato
        const hasRealName = existingContact &&
          existingContact.name !== existingContact.phoneNumber &&
          existingContact.name !== normalizedPhone;
        return {
          id: p.id,
          phoneNumber: normalizedPhone,
          name: existingContact?.customName ?? (hasRealName ? existingContact.name : null),
          avatar: existingContact?.avatar ?? null,
          isAdmin: p.admin === "admin" || p.admin === "superadmin",
          isSuperAdmin: p.admin === "superadmin",
          isMe: normalizedPhone === channelPhone,
        };
      });

      return {
        participants,
        total: participants.length,
        groupName: groupInfo.subject,
        groupOwner: groupInfo.owner,
      };
    }),
});
