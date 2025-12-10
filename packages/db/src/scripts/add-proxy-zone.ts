#!/usr/bin/env tsx
/**
 * Add Proxy Zone
 *
 * Script interativo para inserir zonas de proxy do Bright Data.
 *
 * Uso:
 *   pnpm --filter @manylead/db add-proxy-zone
 *
 * Exemplos:
 *   pnpm --filter @manylead/db add-proxy-zone \
 *     --name manylead_isp_br \
 *     --type isp \
 *     --country br \
 *     --customer-id YOUR_CUSTOMER_ID \
 *     --zone YOUR_ZONE_NAME \
 *     --port 33335 \
 *     --password YOUR_PASSWORD \
 *     --pool-size 10 \
 *     --default
 */

import { db } from "../client";
import { proxyZone } from "../schema/catalog/proxy-zones";
import { encrypt } from "@manylead/crypto";
import { eq } from "drizzle-orm";

const args = process.argv.slice(2);

function getArg(name: string): string | undefined {
  const index = args.findIndex((a) => a === `--${name}`);
  if (index === -1) return undefined;
  return args[index + 1];
}

function hasFlag(name: string): boolean {
  return args.includes(`--${name}`);
}

function printUsage() {
  console.log(`
📦 Add Proxy Zone - Bright Data

Uso:
  pnpm --filter @manylead/db add-proxy-zone [opções]

Opções obrigatórias:
  --name          Nome único da zona (ex: manylead_isp_br)
  --type          Tipo: isp ou residential
  --country       País: br, us, ca, ar, cl, mx, co, pe, pt, es, gb, de, fr
  --customer-id   Customer ID do Bright Data (ex: hl_b91d78ff)
  --zone          Nome da zona no Bright Data (ex: manylead_isp_br)
  --port          Porta do proxy (ISP: 33335, Residential: 22225)
  --password      Senha da zona

Opções opcionais:
  --host          Host do proxy (default: brd.superproxy.io)
  --pool-size     Tamanho do pool de IPs (apenas ISP)
  --default       Marcar como zona padrão para type+country

Exemplo ISP Brasil:
  pnpm --filter @manylead/db add-proxy-zone \\
    --name manylead_isp_br \\
    --type isp \\
    --country br \\
    --customer-id hl_b91d78ff \\
    --zone manylead_isp_br \\
    --port 33335 \\
    --password SUA_SENHA \\
    --pool-size 10 \\
    --default
`);
}

async function main() {
  if (hasFlag("help") || hasFlag("h") || args.length === 0) {
    printUsage();
    process.exit(0);
  }

  const name = getArg("name");
  const type = getArg("type") as "isp" | "residential" | undefined;
  const country = getArg("country");
  const customerId = getArg("customer-id");
  const zone = getArg("zone");
  const port = getArg("port");
  const password = getArg("password");
  const host = getArg("host") ?? "brd.superproxy.io";
  const poolSize = getArg("pool-size");
  const isDefault = hasFlag("default");

  // Validação
  const missing: string[] = [];
  if (!name) missing.push("--name");
  if (!type) missing.push("--type");
  if (!country) missing.push("--country");
  if (!customerId) missing.push("--customer-id");
  if (!zone) missing.push("--zone");
  if (!port) missing.push("--port");
  if (!password) missing.push("--password");

  if (missing.length > 0) {
    console.error(`❌ Parâmetros obrigatórios faltando: ${missing.join(", ")}`);
    console.log("\nUse --help para ver instruções.");
    process.exit(1);
  }

  if (!["isp", "residential"].includes(type!)) {
    console.error("❌ --type deve ser 'isp' ou 'residential'");
    process.exit(1);
  }

  const validCountries = ["br", "us", "ca", "ar", "cl", "mx", "co", "pe", "pt", "es", "gb", "de", "fr"];
  if (!validCountries.includes(country!)) {
    console.error(`❌ --country inválido. Valores válidos: ${validCountries.join(", ")}`);
    process.exit(1);
  }

  try {
    console.log(`\n🔄 Inserindo zona: ${name}`);
    console.log(`   Tipo: ${type}`);
    console.log(`   País: ${country}`);
    console.log(`   Zona: ${zone}`);
    console.log(`   Host: ${host}:${port}`);
    console.log(`   Pool: ${poolSize ?? "N/A"}`);
    console.log(`   Default: ${isDefault}`);

    // Verificar se já existe
    const [existing] = await db
      .select()
      .from(proxyZone)
      .where(eq(proxyZone.name, name!))
      .limit(1);

    if (existing) {
      console.error(`\n❌ Zona "${name}" já existe!`);
      process.exit(1);
    }

    // Encrypt password
    const encryptedPassword = encrypt(password!);

    const [inserted] = await db
      .insert(proxyZone)
      .values({
        name: name!,
        type: type!,
        country: country as "br",
        customerId: customerId!,
        zone: zone!,
        host,
        port: parseInt(port!, 10),
        passwordEncrypted: encryptedPassword.encrypted,
        passwordIv: encryptedPassword.iv,
        passwordTag: encryptedPassword.tag,
        poolSize: poolSize ? parseInt(poolSize, 10) : undefined,
        isDefault,
        status: "active",
      })
      .returning();

    console.log(`\n✅ Zona inserida com sucesso!`);
    console.log(`   ID: ${inserted.id}`);
    console.log(`   Nome: ${inserted.name}`);

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Erro ao inserir zona:", error);
    process.exit(1);
  }
}

main();
