import type Redis from "ioredis";
import type { Tenant } from "@manylead/db";

/**
 * Redis-based distributed cache for tenant metadata
 *
 * ESTRATÉGIA:
 * - Cache de query results (tenant metadata) - Redis distribuído
 * - TTL: 5 minutos (configurável)
 * - Invalidação: manual via invalidate() ou automática por TTL
 * - Fallback: se Redis falhar, bypass cache e query DB diretamente
 */
export class TenantCache {
  private redis: Redis;
  private readonly prefix = "tenant:";
  private readonly ttl = 300; // 5 minutes in seconds

  constructor(redisClient: Redis) {
    this.redis = redisClient;
  }

  /**
   * Cache key for tenant by organizationId
   */
  private getTenantKey(organizationId: string): string {
    return `${this.prefix}${organizationId}:metadata`;
  }

  /**
   * Get tenant from cache
   * Returns null if not found or on Redis error (graceful degradation)
   */
  async get(organizationId: string): Promise<Tenant | null> {
    try {
      const key = this.getTenantKey(organizationId);
      const cached = await this.redis.get(key);

      if (!cached) {
        return null;
      }

      return JSON.parse(cached) as Tenant;
    } catch (error) {
      console.error("[TenantCache] Error getting from cache:", error);
      // Graceful degradation: return null, caller will query DB
      return null;
    }
  }

  /**
   * Set tenant in cache with TTL
   */
  async set(organizationId: string, tenant: Tenant): Promise<void> {
    try {
      const key = this.getTenantKey(organizationId);
      const value = JSON.stringify(tenant);

      await this.redis.setex(key, this.ttl, value);
    } catch (error) {
      console.error("[TenantCache] Error setting cache:", error);
      // Non-blocking: cache write failure doesn't affect the operation
    }
  }

  /**
   * Invalidate tenant cache
   * Call this when tenant is updated/deleted
   */
  async invalidate(organizationId: string): Promise<void> {
    try {
      const key = this.getTenantKey(organizationId);
      await this.redis.del(key);
    } catch (error) {
      console.error("[TenantCache] Error invalidating cache:", error);
      // Non-blocking
    }
  }

  /**
   * Invalidate all tenant caches (use sparingly)
   */
  async invalidateAll(): Promise<void> {
    try {
      const pattern = `${this.prefix}*:metadata`;
      const keys = await this.redis.keys(pattern);

      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      console.error("[TenantCache] Error invalidating all caches:", error);
      // Non-blocking
    }
  }

  /**
   * Get cache statistics for monitoring
   */
  async getStats(): Promise<{
    totalKeys: number;
    memoryUsed: string;
  }> {
    try {
      const pattern = `${this.prefix}*:metadata`;
      const keys = await this.redis.keys(pattern);
      const info = await this.redis.info("memory");

      // Parse memory usage from INFO response
      const memoryRegex = /used_memory_human:(.+)/;
      const memoryMatch = memoryRegex.exec(info);
      const memoryUsed = memoryMatch?.[1]?.trim() ?? "unknown";

      return {
        totalKeys: keys.length,
        memoryUsed,
      };
    } catch (error) {
      console.error("[TenantCache] Error getting stats:", error);
      return {
        totalKeys: 0,
        memoryUsed: "unknown",
      };
    }
  }
}
