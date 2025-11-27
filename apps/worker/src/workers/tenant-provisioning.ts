import type { Job } from "bullmq";
import Redis from "ioredis";
import { TenantDatabaseManager } from "@manylead/tenant-db";
import { agent } from "@manylead/db";
import { logger } from "~/libs/utils/logger";
import { env } from "~/env";

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
 * Provisioning event for Socket.io
 */
interface ProvisioningEvent {
  type: "provisioning:progress" | "provisioning:complete" | "provisioning:error";
  organizationId: string;
  data: {
    progress?: number;
    currentStep?: string;
    message?: string;
    error?: string;
  };
}

/**
 * Redis publisher for real-time updates
 * PERFORMANCE OPTIMIZATION: enableAutoPipelining batches publish commands
 */
const redisPublisher = new Redis(env.REDIS_URL, {
  lazyConnect: false, // Connect immediately
  enableAutoPipelining: true, // Batch commands for low latency
  keepAlive: 30000, // Keep TCP connection alive
  connectTimeout: 10000, // 10 second timeout
});

/**
 * Publish provisioning event to Redis channel
 */
async function publishEvent(event: ProvisioningEvent): Promise<void> {
  try {
    await redisPublisher.publish("tenant:provisioning", JSON.stringify(event));
    logger.debug({ event }, "Published provisioning event to Redis");
  } catch (error) {
    logger.error({ error, event }, "Failed to publish event to Redis");
  }
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

  const tenantManager = new TenantDatabaseManager();

  try {
    // Step 1: Starting provisioning
    await job.updateProgress(5);
    await publishEvent({
      type: "provisioning:progress",
      organizationId,
      data: {
        progress: 5,
        currentStep: "starting",
        message: "Iniciando...",
      },
    });

    logger.info({ organizationId }, "Starting tenant provisioning...");

    // Step 2: Get tenant record (already created by provisionTenantAsync)
    await job.updateProgress(20);
    await publishEvent({
      type: "provisioning:progress",
      organizationId,
      data: {
        progress: 20,
        currentStep: "creating_database",
        message: "Preparando tudo...",
      },
    });

    // Get the tenant that was already created by the API
    const tenant = await tenantManager.getTenantByOrganization(organizationId);
    if (!tenant) {
      throw new Error(`Tenant not found for organization ${organizationId}`);
    }

    logger.info({ organizationId, tenantId: tenant.id }, "Tenant found, creating physical database...");

    // Call completeTenantProvisioning which creates DB + runs migrations
    await tenantManager.completeTenantProvisioning(organizationId);

    logger.info({ organizationId, tenantId: tenant.id }, "Tenant database created and migrations applied");

    // Step 3: Running migrations
    await job.updateProgress(60);
    await publishEvent({
      type: "provisioning:progress",
      organizationId,
      data: {
        progress: 60,
        currentStep: "running_migrations",
        message: "Configurando...",
      },
    });

    // Migrations are run by provisionTenant, just wait a bit for effect
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Step 4: Seeding data
    await job.updateProgress(80);
    await publishEvent({
      type: "provisioning:progress",
      organizationId,
      data: {
        progress: 80,
        currentStep: "seeding_data",
        message: "Ajustando detalhes...",
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 500));

    // Step 5: Create owner agent
    await job.updateProgress(85);
    await publishEvent({
      type: "provisioning:progress",
      organizationId,
      data: {
        progress: 85,
        currentStep: "creating_owner",
        message: "Criando seu perfil...",
      },
    });

    const tenantDb = await tenantManager.getConnection(organizationId);
    await tenantDb.insert(agent).values({
      userId: ownerId,
      role: "owner",
      permissions: {
        departments: { type: "all" },
        channels: { type: "all" },
        messages: { canEdit: false, canDelete: false },
        accessFinishedChats: false,
      },
      isActive: true,
    });

    logger.info({ organizationId, ownerId }, "Owner agent created");

    // Step 6: Finalizing
    await job.updateProgress(95);
    await publishEvent({
      type: "provisioning:progress",
      organizationId,
      data: {
        progress: 95,
        currentStep: "finalizing",
        message: "Finalizando...",
      },
    });

    // Update tenant status to active
    await tenantManager.updateTenantStatus(tenant.id, "active");

    await job.updateProgress(100);

    // Step 6: Complete
    await publishEvent({
      type: "provisioning:complete",
      organizationId,
      data: {
        progress: 100,
        currentStep: "completed",
        message: "Concluído!",
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
    await publishEvent({
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
