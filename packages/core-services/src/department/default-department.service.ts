import { and, department, eq } from "@manylead/db";
import type { TenantDB } from "@manylead/db";

/**
 * Busca o departamento padrão de uma organização
 * Garante que sempre retorna um departamento (valida integridade)
 */
export async function getDefaultDepartment(
  tenantDb: TenantDB,
  organizationId: string,
): Promise<string> {
  const [defaultDept] = await tenantDb
    .select({ id: department.id })
    .from(department)
    .where(
      and(
        eq(department.organizationId, organizationId),
        eq(department.isDefault, true),
        eq(department.isActive, true),
      ),
    )
    .limit(1);

  if (!defaultDept) {
    throw new Error(
      `No default department found for organization ${organizationId}`,
    );
  }

  return defaultDept.id;
}
