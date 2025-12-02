import type postgres from "postgres";

/**
 * Seed de dados padrões para novos tenants
 * Cria tags e endings iniciais
 */
export async function seedTenantDefaults(
  client: ReturnType<typeof postgres>,
  organizationId: string,
): Promise<void> {
  console.log("[Seed] Creating default department, tags and endings...");

  try {
    // ============================================================================
    // 1. CRIAR DEPARTAMENTO PADRÃO
    // ============================================================================
    await client`
      INSERT INTO department (organization_id, name, is_default, is_active)
      VALUES (${organizationId}, 'Geral', true, true)
      ON CONFLICT (organization_id, name) DO NOTHING
    `;

    console.log("[Seed] ✅ Created default department 'Geral'");

    // ============================================================================
    // 2. CRIAR TAGS PADRÕES
    // ============================================================================
    const defaultTags = [
      { name: "Aguardando retorno", color: "#22c55e" }, // verde (green-500)
      { name: "Interno", color: "#991b1b" }, // vinho (red-800)
      { name: "Novo", color: "#3b82f6" }, // azul (blue-500)
    ];

    for (const tagData of defaultTags) {
      await client`
        INSERT INTO tag (organization_id, name, color)
        VALUES (${organizationId}, ${tagData.name}, ${tagData.color})
        ON CONFLICT (organization_id, name) DO NOTHING
      `;
    }

    console.log(`[Seed] ✅ Created ${defaultTags.length} default tags`);

    // ============================================================================
    // 3. CRIAR ENDINGS PADRÕES
    // ============================================================================
    const defaultEndings = [
      { title: "Dúvida" },
      { title: "Engano" },
      { title: "Pendente" },
      { title: "Rejeitado" },
      { title: "Resolvido" },
    ];

    for (const endingData of defaultEndings) {
      await client`
        INSERT INTO ending (organization_id, title, rating_behavior)
        VALUES (${organizationId}, ${endingData.title}, 'default')
        ON CONFLICT (organization_id, title) DO NOTHING
      `;
    }

    console.log(
      `[Seed] ✅ Created ${defaultEndings.length} default endings`,
    );

    console.log("[Seed] 🎉 Tenant seed completed successfully!");
  } catch (error) {
    console.error("[Seed] ❌ Failed to seed tenant defaults:", error);
    throw new Error(
      `Failed to seed tenant defaults: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
