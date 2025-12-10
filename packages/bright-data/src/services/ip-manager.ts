/**
 * IP Manager Service
 *
 * Gerencia alocação automática de IPs ISP via API do Bright Data.
 * Sob demanda: 1 org = 1 IP. Adiciona IPs quando necessário.
 */

import { db, proxyZone, eq, and } from "@manylead/db";
import type { ProxyCountry } from "../types";
import { env } from "../env";

const BRIGHT_DATA_API_URL = "https://api.brightdata.com";

/**
 * Bright Data API response for adding IPs
 */
interface AddIpsResponse {
  ips?: string[];
  new_ips?: string[];
}

/**
 * Bright Data API response for getting zone IPs
 */
interface ZoneIpsResponse {
  ips?: string[];
}

/**
 * Get current IP count from Bright Data API
 */
export async function getZoneIpCount(
  customerId: string,
  zone: string,
): Promise<number> {
  const response = await fetch(
    `${BRIGHT_DATA_API_URL}/zone/ips?customer=${customerId}&zone=${zone}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${env.BRIGHT_DATA_API_TOKEN}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Bright Data API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as ZoneIpsResponse;
  return data.ips?.length ?? 0;
}

/**
 * Add IPs to a zone via Bright Data API
 */
export async function addIpsToZone(
  customerId: string,
  zone: string,
  count: number,
  country: string,
): Promise<string[]> {
  const response = await fetch(`${BRIGHT_DATA_API_URL}/zone/ips`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.BRIGHT_DATA_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      customer: customerId,
      zone,
      count,
      country,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Bright Data API error: ${response.status} - ${errorText}`);
  }

  const data = (await response.json()) as AddIpsResponse;
  return data.new_ips ?? [];
}

/**
 * Ensure there's an available IP for a new organization (ISP only)
 *
 * Verifica se há IP disponível baseado no número de orgs ativas.
 * Se não houver, adiciona um novo IP via API.
 *
 * @param country - Country code
 * @param activeOrgCount - Number of organizations with active ISP proxy
 * @returns Object with zone info and whether a new IP was added
 */
export async function ensureIspIpAvailable(
  country: ProxyCountry,
  activeOrgCount: number,
): Promise<{
  zoneId: string;
  customerId: string;
  zoneName: string;
  poolSize: number;
  newIpAdded: boolean;
  newIps?: string[];
}> {
  // Buscar zona ISP no banco
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
    throw new Error(`Zona ISP para ${country} não encontrada`);
  }

  const currentPoolSize = zone.poolSize ?? 0;

  // Se ainda tem IP disponível, não precisa adicionar
  if (activeOrgCount < currentPoolSize) {
    return {
      zoneId: zone.id,
      customerId: zone.customerId,
      zoneName: zone.zone,
      poolSize: currentPoolSize,
      newIpAdded: false,
    };
  }

  // Precisa adicionar IP
  console.log(`[IP-Manager] Pool cheio (${activeOrgCount}/${currentPoolSize}). Adicionando IP...`);

  const newIps = await addIpsToZone(
    zone.customerId,
    zone.zone,
    1, // Adiciona 1 IP por vez
    country,
  );

  // Atualizar poolSize no banco
  const newPoolSize = currentPoolSize + newIps.length;

  await db
    .update(proxyZone)
    .set({
      poolSize: newPoolSize,
      updatedAt: new Date(),
    })
    .where(eq(proxyZone.id, zone.id));

  console.log(`[IP-Manager] IP adicionado. Novo poolSize: ${newPoolSize}`);

  return {
    zoneId: zone.id,
    customerId: zone.customerId,
    zoneName: zone.zone,
    poolSize: newPoolSize,
    newIpAdded: true,
    newIps,
  };
}

/**
 * Sync pool size with Bright Data API
 */
export async function syncPoolSize(country: ProxyCountry): Promise<number> {
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
    throw new Error(`Zona ISP para ${country} não encontrada`);
  }

  const actualCount = await getZoneIpCount(zone.customerId, zone.zone);

  if (actualCount !== zone.poolSize) {
    console.log(`[IP-Manager] Sincronizando poolSize: ${zone.poolSize} → ${actualCount}`);

    await db
      .update(proxyZone)
      .set({
        poolSize: actualCount,
        updatedAt: new Date(),
      })
      .where(eq(proxyZone.id, zone.id));
  }

  return actualCount;
}
