# TODO: Refatorar para usar Better Auth Organization Plugin

## Status Atual (o que já fizemos)
✅ Adicionado plugin `organization` no `packages/auth/src/index.ts`
✅ Gerado schema do Better Auth com `npx @better-auth/cli generate`
✅ Criado schemas catalog: `organization.ts`, `member.ts`, `invitation.ts`
✅ Atualizado `session.ts` com campo `activeOrganizationId`
✅ Exportado novos schemas no `packages/db/src/schema/catalog/auth/index.ts`

## Próximos Passos

### 1. Gerar e aplicar migrations do catalog
```bash
cd packages/db
pnpm db:generate  # gerar migration com novos schemas
pnpm db:push      # aplicar no banco
```

### 2. Remover schemas DUPLICADOS do tenant
**Deletar:**
- `packages/db/src/schema/tenant/organizations/`
- `packages/db/src/schema/tenant/organization-members/`
- `packages/db/src/schema/tenant/organization-invitations/`
- `packages/db/src/schema/tenant/relations.ts`

**Atualizar:**
- `packages/db/src/schema/tenant/index.ts` - remover exports dessas pastas

### 3. Deletar migrations do tenant
```bash
rm -rf packages/db/drizzle/tenant/
rm packages/db/drizzle.config.tenant.ts
```

### 4. Dropar tabelas do tenant acme-corp
```bash
cd packages/tenant-db
pnpm with-env psql $DATABASE_URL_DIRECT -c "\\c org_acme_corp"
DROP TABLE organization_invitations;
DROP TABLE organization_members;
DROP TABLE organizations;
```

### 5. Refatorar `packages/api/src/router/organization.ts`

**Remover:**
- Import de `organizations`, `organizationMembers` do `@manylead/db`
- Instância local de `TenantDatabaseManager`
- Todos os procedures que fazem queries manuais

**Usar Better Auth APIs:**
```typescript
// Criar organization
await ctx.authApi.organization.create({ name, slug });

// Listar organizations do user
const orgs = await ctx.authApi.organization.listUserOrganizations();

// Adicionar membro
await ctx.authApi.organization.inviteMember({ email, role });

// etc...
```

### 6. Integrar TenantDatabaseManager com Better Auth Hooks

Em `packages/auth/src/index.ts`, adicionar hooks:

```typescript
organization({
  // ... config existente
  hooks: {
    afterCreateOrganization: async ({ organization }) => {
      // Provisionar tenant database
      const tenantManager = new TenantDatabaseManager();
      await tenantManager.provisionTenant({
        organizationId: organization.id,
        slug: organization.slug,
        name: organization.name,
      });
    },
    // Similar para delete, etc
  }
})
```

### 7. Ajustar tRPC context

O `ctx.session` do Better Auth JÁ vem com:
- `activeOrganizationId` - ID da org ativa
- User's role na org ativa

**Remover** do `trpc.ts`:
- Todo o código do middleware `enforceUserHasOrganization` que criamos
- Export do `tenantManager`

**Usar direto nos routers:**
```typescript
const orgId = ctx.session.activeOrganizationId;
const tenantDb = await tenantManager.getConnection(orgId);
```

### 8. Atualizar scripts de tenant

`packages/tenant-db/src/scripts/create-tenant.ts`:
- Mudar para receber `organizationId` (que já existe no catalog via Better Auth)
- Remover lógica de criar organization

### 9. Testar fluxo completo

1. Criar user via Better Auth
2. Criar organization via Better Auth API
3. Hook provisiona tenant DB automaticamente
4. Session tem `activeOrganizationId`
5. tRPC routers usam Better Auth APIs

## Arquitetura Final

**Catalog DB (Better Auth gerencia):**
- user, session, account, verification
- organization, member, invitation ← Better Auth
- tenant ← nosso (mapeia org → DB físico)

**Tenant DB (por org):**
- Apenas dados de negócio (leads, campaigns, etc)
- SEM organization/member/invitation

**Context:**
- `ctx.session.activeOrganizationId` ← Better Auth
- `ctx.session.user` com role ← Better Auth
- `tenantManager.getConnection(orgId)` ← nosso

## Benefícios

✅ Menos código para manter
✅ Better Auth é battle-tested
✅ UI components prontos
✅ Roles/permissions gerenciados
✅ Foco em features de negócio
