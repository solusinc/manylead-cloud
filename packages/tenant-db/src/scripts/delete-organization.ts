#!/usr/bin/env tsx
import { createInterface } from "node:readline/promises";
import { eq } from "drizzle-orm";

import { db } from "@manylead/db/client";
import { organization, member, session, tenant } from "@manylead/db";
import { TenantDatabaseManager } from "../tenant-manager";

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function deleteOrganization() {
  console.log("🗑️  Delete Organization (Better Auth + Tenant)\n");

  // 1. Listar organizações disponíveis
  const orgs = await db.select().from(organization).orderBy(organization.createdAt);

  if (orgs.length === 0) {
    console.log("❌ Nenhuma organização encontrada.");
    process.exit(0);
  }

  console.log("📋 Organizações disponíveis:\n");
  orgs.forEach((org, index) => {
    console.log(`${index + 1}. ${org.name} (${org.slug})`);
  });
  console.log();

  // 2. Selecionar organização
  const answer = await rl.question("Digite o número da organização para deletar (ou 'cancel'): ");

  if (answer.toLowerCase() === "cancel") {
    console.log("❌ Operação cancelada.");
    process.exit(0);
  }

  const orgIndex = parseInt(answer, 10) - 1;
  const selectedOrg = orgs[orgIndex];

  if (!selectedOrg) {
    console.log("❌ Organização inválida.");
    process.exit(1);
  }

  console.log(`\n⚠️  Você está prestes a deletar: ${selectedOrg.name} (${selectedOrg.slug})`);

  // 3. Confirmar deleção
  const confirmAnswer = await rl.question(
    "Digite o slug da organização para confirmar: ",
  );

  if (confirmAnswer !== selectedOrg.slug) {
    console.log("❌ Confirmação inválida. Operação cancelada.");
    process.exit(1);
  }

  // 4. Tipo de deleção do tenant
  const deleteTypeAnswer = await rl.question(
    "\nTipo de deleção do tenant:\n1. Soft delete (marca como deleted, mantém DB)\n2. Hard delete (deleta DB físico)\n\nEscolha (1 ou 2): ",
  );

  const isHardDelete = deleteTypeAnswer === "2";

  rl.close();

  console.log("\n🔄 Deletando organização...\n");

  try {
    const tenantManager = new TenantDatabaseManager();

    // 5. Buscar tenant
    const tenantRecord = await db
      .select()
      .from(tenant)
      .where(eq(tenant.organizationId, selectedOrg.id))
      .limit(1);

    // 6. Deletar tenant (se existir)
    if (tenantRecord[0]) {
      console.log(`📦 Tenant encontrado: ${tenantRecord[0].slug}`);

      if (isHardDelete) {
        console.log("🗑️  Hard delete: deletando database físico...");
        await tenantManager.purgeTenant(selectedOrg.id);
        console.log("✅ Tenant deletado (hard delete)");
      } else {
        console.log("🗑️  Soft delete: marcando como deleted...");
        await tenantManager.deleteTenant(selectedOrg.id);
        console.log("✅ Tenant deletado (soft delete)");
      }
    } else {
      console.log("⚠️  Tenant não encontrado (organização sem tenant provisionado)");
    }

    // 7. Deletar membros
    const deletedMembers = await db
      .delete(member)
      .where(eq(member.organizationId, selectedOrg.id))
      .returning();

    console.log(`✅ ${deletedMembers.length} membro(s) deletado(s)`);

    // 8. Limpar sessões ativas
    await db
      .update(session)
      .set({ activeOrganizationId: null })
      .where(eq(session.activeOrganizationId, selectedOrg.id));

    console.log("✅ Sessões limpas");

    // 9. Deletar organização
    await db.delete(organization).where(eq(organization.id, selectedOrg.id));

    console.log("✅ Organização deletada");

    console.log(`\n🎉 Organização '${selectedOrg.name}' deletada com sucesso!`);

    await tenantManager.close();
  } catch (error) {
    console.error("\n❌ Erro ao deletar organização:", error);
    process.exit(1);
  }
}

deleteOrganization()
  .catch(console.error)
  .finally(() => process.exit(0));
