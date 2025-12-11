import type { Job } from "bullmq";
import { agent } from "@manylead/db";
import { logger } from "~/libs/utils/logger";
import { eventPublisher } from "~/libs/cache/event-publisher";
import { tenantManager } from "~/libs/tenant-manager";

/**
 * Tenant provisioning job data schema
 */
export interface TenantProvisioningJobData {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  ownerId: string; // userId do criador da organização (será o owner agent)
}

/**
 * Tenant provisioning progress steps
 */
const PROGRESS = {
  STARTING: 5,
  CREATING_DATABASE: 20,
  RUNNING_MIGRATIONS: 60,
  SEEDING_DATA: 80,
  CREATING_OWNER: 85,
  FINALIZING: 95,
  COMPLETE: 100,
} as const;

/**
 * Progress step metadata for UI feedback
 */
const PROGRESS_STEPS = {
  [PROGRESS.STARTING]: {
    step: "starting",
    message: "Iniciando...",
  },
  [PROGRESS.CREATING_DATABASE]: {
    step: "creating_database",
    message: "Preparando tudo...",
  },
  [PROGRESS.RUNNING_MIGRATIONS]: {
    step: "running_migrations",
    message: "Configurando...",
  },
  [PROGRESS.SEEDING_DATA]: {
    step: "seeding_data",
    message: "Ajustando detalhes...",
  },
  [PROGRESS.CREATING_OWNER]: {
    step: "creating_owner",
    message: "Criando seu perfil...",
  },
  [PROGRESS.FINALIZING]: {
    step: "finalizing",
    message: "Finalizando...",
  },
  [PROGRESS.COMPLETE]: {
    step: "completed",
    message: "Concluído!",
  },
} as const;

/**
 * Helper to update job progress and publish event to Redis
 *
 * Centralizes progress updates to avoid repetition and ensure
 * consistency between job.updateProgress() and Redis event publishing.
 *
 * @param job - BullMQ job instance
 * @param organizationId - Organization ID for event publishing
 * @param progressValue - Progress percentage (from PROGRESS constants)
 */
async function updateProgress(
  job: Job<TenantProvisioningJobData>,
  organizationId: string,
  progressValue: number,
): Promise<void> {
  await job.updateProgress(progressValue);

  const stepInfo = PROGRESS_STEPS[progressValue as keyof typeof PROGRESS_STEPS];

  await eventPublisher.publish("tenant:provisioning", {
    type: "provisioning:progress",
    organizationId,
    data: {
      progress: progressValue,
      currentStep: stepInfo.step,
      message: stepInfo.message,
    },
  });
}

/**
 * Process tenant provisioning job
 *
 * This function:
 * 1. Provisions a new tenant database
 * 2. Runs migrations and seeds
 * 3. Publishes real-time updates via Redis Pub/Sub for Socket.io
 * 4. Updates provisioning_details in catalog
 */
export async function processTenantProvisioning(
  job: Job<TenantProvisioningJobData>,
): Promise<void> {
  const { organizationId, organizationName, organizationSlug, ownerId } = job.data;

  logger.info(
    { jobId: job.id, organizationId, organizationName, organizationSlug },
    "Processing tenant provisioning job",
  );

  try {
    // Step 1: Starting provisioning
    await updateProgress(job, organizationId, PROGRESS.STARTING);
    logger.info({ organizationId }, "Starting tenant provisioning...");

    // Step 2: Get tenant record (already created by provisionTenantAsync)
    await updateProgress(job, organizationId, PROGRESS.CREATING_DATABASE);

    // Get the tenant that was already created by the API
    const tenant = await tenantManager.getTenantByOrganization(organizationId);
    if (!tenant) {
      logger.warn(
        { organizationId, jobId: job.id },
        "Tenant not found - likely deleted. Skipping provisioning job.",
      );
      return; // Silently skip - tenant was deleted
    }

    logger.info({ organizationId, tenantId: tenant.id }, "Tenant found, creating physical database...");

    // Call completeTenantProvisioning which creates DB + runs migrations
    await tenantManager.completeTenantProvisioning(organizationId);

    logger.info({ organizationId, tenantId: tenant.id }, "Tenant database created and migrations applied");

    // Step 3: Running migrations
    await updateProgress(job, organizationId, PROGRESS.RUNNING_MIGRATIONS);

    // Migrations are run by provisionTenant, just wait a bit for effect
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Step 4: Seeding data
    await updateProgress(job, organizationId, PROGRESS.SEEDING_DATA);

    await new Promise((resolve) => setTimeout(resolve, 500));

    // Step 5: Create owner agent
    await updateProgress(job, organizationId, PROGRESS.CREATING_OWNER);

    // Use direct connection (bypass pgbouncer) to avoid CONNECTION_ENDED errors
    // during provisioning. PGBouncer closes connections between transactions,
    // which can cause issues when creating the owner agent immediately after
    // running migrations/seeds.
    const tenantDb = await tenantManager.getDirectConnection(organizationId);

    await tenantDb.insert(agent).values({
      userId: ownerId,
      role: "owner",
      permissions: {
        departments: { type: "all" },
        channels: { type: "all" },
        messages: { canEdit: false, canDelete: false },
        accessFinishedChats: false,
        notificationSoundsEnabled: true,
      },
      isActive: true,
    });

    logger.info({ organizationId, ownerId }, "Owner agent created");

    // Step 6: Finalizing
    await updateProgress(job, organizationId, PROGRESS.FINALIZING);

    // Update tenant status to active
    await tenantManager.updateTenantStatus(tenant.id, "active");

    // Step 7: Complete
    await job.updateProgress(PROGRESS.COMPLETE);
    await eventPublisher.publish("tenant:provisioning", {
      type: "provisioning:complete",
      organizationId,
      data: {
        progress: PROGRESS.COMPLETE,
        currentStep: PROGRESS_STEPS[PROGRESS.COMPLETE].step,
        message: PROGRESS_STEPS[PROGRESS.COMPLETE].message,
      },
    });

    logger.info(
      { jobId: job.id, organizationId, tenantId: tenant.id },
      "Tenant provisioning completed successfully",
    );
  } catch (error) {
    logger.error(
      { jobId: job.id, organizationId, error },
      "Tenant provisioning failed",
    );

    // Publish error event
    await eventPublisher.publish("tenant:provisioning", {
      type: "provisioning:error",
      organizationId,
      data: {
        error: error instanceof Error ? error.message : "Unknown error",
        message: "Falha no provisionamento do tenant",
      },
    });

    throw error;
  }
}
