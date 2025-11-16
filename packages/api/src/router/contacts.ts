import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { contact, count, desc, eq, ilike, or } from "@manylead/db";

import { createTRPCRouter, ownerProcedure } from "../trpc";

/**
 * Contacts Router
 *
 * Gerencia contatos (WhatsApp contacts) do tenant
 */
export const contactsRouter = createTRPCRouter({
  /**
   * Listar contatos com paginação e busca
   */
  list: ownerProcedure
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
  getById: ownerProcedure
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
  findOrCreate: ownerProcedure
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
   * Atualizar contato
   */
  update: ownerProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().optional(),
        email: z.string().email().optional(),
        avatar: z.string().url().optional(),
        customFields: z.record(z.string(), z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

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

      return updated;
    }),

  /**
   * Deletar contato
   */
  delete: ownerProcedure
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
});
