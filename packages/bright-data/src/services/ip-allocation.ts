/**
 * IP Allocation Service
 *
 * Manages dedicated IP allocation for ISP proxies.
 * Each organization gets one dedicated IP (managed by Bright Data via session ID).
 */

import { db, proxyIpAllocation, proxyZone, eq, and, count } from "@manylead/db";
import { createLogger } from "@manylead/clients/logger";
import type { ProxyCountry } from "../types";
import { generateSessionId } from "../utils/session-manager";

const logger = createLogger({ component: "IpAllocation" });

interface IpAllocation {
  sessionId: string;
  isNew: boolean;
}

/**
 * Allocate IP for an organization
 *
 * Flow:
 * 1. Check if org already has active IP → reuse
 * 2. Check if pool has available slots
 * 3. Generate session ID (Bright Data assigns dedicated IP automatically)
 * 4. Register allocation in database
 *
 * @returns Session ID to use (each session ID gets a dedicated IP from Bright Data)
 */
export async function allocateIp(
  organizationId: string,
  country: ProxyCountry,
): Promise<IpAllocation> {
  logger.info({ organizationId, country }, "Starting IP allocation");

  // 1. Check if org already has active IP allocation
  const [existing] = await db
    .select()
    .from(proxyIpAllocation)
    .where(
      and(
        eq(proxyIpAllocation.organizationId, organizationId),
        eq(proxyIpAllocation.status, "active"),
      ),
    )
    .limit(1);

  if (existing) {
    logger.info(
      {
        organizationId,
        sessionId: existing.sessionId,
      },
      "Reusing existing IP allocation",
    );
    return {
      sessionId: existing.sessionId,
      isNew: false,
    };
  }

  // 2. Find ISP zone for country
  const [zone] = await db
    .select()
    .from(proxyZone)
    .where(
      and(
        eq(proxyZone.type, "isp"),
        eq(proxyZone.country, country),
        eq(proxyZone.status, "active"),
      ),
    )
    .limit(1);

  if (!zone) {
    throw new Error(`ISP zone for ${country} not found`);
  }

  logger.info(
    {
      zoneId: zone.id,
      zoneName: zone.zone,
      currentPoolSize: zone.poolSize,
    },
    "Found ISP zone",
  );

  // 3. Count active allocations for this zone
  const result = await db
    .select({ activeCount: count() })
    .from(proxyIpAllocation)
    .where(
      and(
        eq(proxyIpAllocation.proxyZoneId, zone.id),
        eq(proxyIpAllocation.status, "active"),
      ),
    );

  const activeCount = result[0]?.activeCount ?? 0;

  logger.info(
    {
      activeAllocations: activeCount,
      maxPoolSize: zone.poolSize ?? 0,
    },
    "Checked pool availability",
  );

  // 4. Check if pool has available slots
  const maxPoolSize = zone.poolSize ?? 0;
  if (activeCount >= maxPoolSize) {
    logger.error(
      {
        activeCount,
        maxPoolSize,
        organizationId,
      },
      "Pool is full - cannot allocate IP",
    );

    throw new Error(
      `Limite de IPs atingido. Pool atual: ${maxPoolSize}, IPs em uso: ${activeCount}. ` +
      `Entre em contato com o suporte para aumentar o limite.`,
    );
  }

  logger.info(
    {
      activeCount,
      maxPoolSize,
      availableSlots: maxPoolSize - activeCount,
    },
    "Pool has available slots",
  );

  // 5. Generate session ID and register allocation
  const sessionId = generateSessionId(organizationId);

  await db.insert(proxyIpAllocation).values({
    organizationId,
    proxyZoneId: zone.id,
    sessionId,
    status: "active",
  });

  logger.info(
    {
      organizationId,
      sessionId,
    },
    "IP allocation completed successfully",
  );

  return {
    sessionId,
    isNew: true,
  };
}

/**
 * Release IP allocation for an organization
 *
 * Called when:
 * - Channel is deleted
 * - Organization is deleted (cascades automatically via FK)
 *
 * Marks allocation as 'released' instead of deleting to keep history.
 */
export async function releaseIp(organizationId: string): Promise<void> {
  logger.info({ organizationId }, "Releasing IP allocation");

  await db
    .update(proxyIpAllocation)
    .set({
      status: "released",
      releasedAt: new Date(),
    })
    .where(
      and(
        eq(proxyIpAllocation.organizationId, organizationId),
        eq(proxyIpAllocation.status, "active"),
      ),
    );

  logger.info({ organizationId }, "IP allocation released successfully");
}

/**
 * Get IP allocation for an organization
 */
export async function getIpAllocation(
  organizationId: string,
): Promise<IpAllocation | null> {
  const [allocation] = await db
    .select()
    .from(proxyIpAllocation)
    .where(
      and(
        eq(proxyIpAllocation.organizationId, organizationId),
        eq(proxyIpAllocation.status, "active"),
      ),
    )
    .limit(1);

  if (!allocation) {
    return null;
  }

  return {
    sessionId: allocation.sessionId,
    isNew: false,
  };
}
