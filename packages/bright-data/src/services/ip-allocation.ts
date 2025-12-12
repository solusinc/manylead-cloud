/**
 * IP Allocation Service
 *
 * Manages dedicated IP allocation for ISP proxies.
 * Each organization gets one dedicated IP from the pool.
 */

import { db, proxyIpAllocation, proxyZone, eq, and } from "@manylead/db";
import { createLogger } from "@manylead/clients/logger";
import type { ProxyCountry } from "../types";
import { generateSessionId } from "../utils/session-manager";

const logger = createLogger({ component: "IpAllocation" });

interface IpAllocation {
  ipIndex: number;
  sessionId: string;
  isNew: boolean;
}

/**
 * Allocate IP for an organization
 *
 * Flow:
 * 1. Check if org already has active IP → reuse
 * 2. Find next available IP index in pool
 * 3. If pool full → add new IP via Bright Data API
 * 4. Register allocation in database
 *
 * @returns IP index and session ID to use
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
        ipIndex: existing.ipIndex,
        sessionId: existing.sessionId,
      },
      "Reusing existing IP allocation",
    );
    return {
      ipIndex: existing.ipIndex,
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

  // 3. Find next available IP index
  const allocations = await db
    .select({ ipIndex: proxyIpAllocation.ipIndex })
    .from(proxyIpAllocation)
    .where(
      and(
        eq(proxyIpAllocation.proxyZoneId, zone.id),
        eq(proxyIpAllocation.status, "active"),
      ),
    )
    .orderBy(proxyIpAllocation.ipIndex);

  // Find first gap in sequence or use next index
  let nextIpIndex = 0;
  const usedIndices = new Set(allocations.map((a) => a.ipIndex));

  while (usedIndices.has(nextIpIndex)) {
    nextIpIndex++;
  }

  logger.info(
    {
      usedIndices: Array.from(usedIndices),
      nextIpIndex,
      currentPoolSize: zone.poolSize ?? 0,
    },
    "Calculated next IP index",
  );

  // 4. Check if pool has available IPs
  const maxPoolSize = zone.poolSize ?? 0;
  if (nextIpIndex >= maxPoolSize) {
    logger.error(
      {
        nextIpIndex,
        maxPoolSize,
        organizationId,
      },
      "Pool is full - cannot allocate IP",
    );

    throw new Error(
      `Limite de IPs atingido. Pool atual: ${maxPoolSize}, IPs em uso: ${usedIndices.size}. ` +
      `Entre em contato com o suporte para aumentar o limite.`,
    );
  }

  logger.info(
    {
      nextIpIndex,
      maxPoolSize,
      availableSlots: maxPoolSize - nextIpIndex - 1,
    },
    "Using IP from pool",
  );

  // 5. Generate session ID and register allocation
  const sessionId = generateSessionId(organizationId);

  await db.insert(proxyIpAllocation).values({
    organizationId,
    proxyZoneId: zone.id,
    ipIndex: nextIpIndex,
    sessionId,
    status: "active",
  });

  logger.info(
    {
      organizationId,
      ipIndex: nextIpIndex,
      sessionId,
    },
    "IP allocation completed successfully",
  );

  return {
    ipIndex: nextIpIndex,
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
    ipIndex: allocation.ipIndex,
    sessionId: allocation.sessionId,
    isNew: false,
  };
}
