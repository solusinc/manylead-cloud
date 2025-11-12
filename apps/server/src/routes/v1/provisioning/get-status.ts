import type { Hono } from "hono";
import { z } from "zod/v4";
import { eq, tenant } from "@manylead/db";
import { db } from "@manylead/db/client";
import { errorResponse, TenantNotFoundError } from "~/libs/errors";

// Validation schema
const paramsSchema = z.object({
  organizationId: z.uuid(),
});

/**
 * GET /v1/provisioning/:organizationId
 * Get provisioning status for an organization
 *
 * TODO (FASE 4): Add provisioningDetails column to response
 */
export function registerGetProvisioningStatus(app: Hono) {
  return app.get("/:organizationId", async (c) => {
    // Validate params with Zod
    const result = paramsSchema.safeParse({
      organizationId: c.req.param("organizationId"),
    });

    if (!result.success) {
      return c.json(
        {
          error: "Validation Error",
          issues: result.error.issues,
        },
        400,
      );
    }

    const { organizationId } = result.data;

    try {
      // Query tenant from catalog
      const tenantRecord = await db.query.tenant.findFirst({
        where: eq(tenant.organizationId, organizationId),
        columns: {
          id: true,
          organizationId: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!tenantRecord) {
        throw new TenantNotFoundError(organizationId);
      }

      return c.json({
        organizationId: tenantRecord.organizationId,
        status: tenantRecord.status,
        createdAt: tenantRecord.createdAt,
        updatedAt: tenantRecord.updatedAt,
      });
    } catch (error) {
      if (error instanceof TenantNotFoundError) {
        return errorResponse(c, error.message, 404);
      }

      return errorResponse(c, "Failed to fetch provisioning status", 500);
    }
  });
}
