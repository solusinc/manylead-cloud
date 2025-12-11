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

interface ValidatedArgs {
  name: string;
  type: "isp" | "residential";
  country: string;
  customerId: string;
  zone: string;
  port: string;
  password: string;
  host: string;
  poolSize?: string;
  isDefault: boolean;
}

const args = process.argv.slice(2);

function getArg(name: string): string | undefined {
  const index = args.findIndex((a) => a === `--${name}`);
  if (index === -1) return undefined;
  return args[index + 1];
}

function hasFlag(name: string): boolean {
  return args.includes(`--${name}`);
}

function validateArgs(args: {
  name?: string;
  type?: "isp" | "residential";
  country?: string;
  customerId?: string;
  zone?: string;
  port?: string;
  password?: string;
  host: string;
  poolSize?: string;
  isDefault: boolean;
}): ValidatedArgs {
  const missing: string[] = [];
  if (!args.name) missing.push("--name");
  if (!args.type) missing.push("--type");
  if (!args.country) missing.push("--country");
  if (!args.customerId) missing.push("--customer-id");
  if (!args.zone) missing.push("--zone");
  if (!args.port) missing.push("--port");
  if (!args.password) missing.push("--password");

  if (missing.length > 0) {
    console.error(`❌ Parâmetros obrigatórios faltando: ${missing.join(", ")}`);
    console.log("\nUse --help para ver instruções.");
    process.exit(1);
  }

  if (args.type && !["isp", "residential"].includes(args.type)) {
    console.error("❌ --type deve ser 'isp' ou 'residential'");
    process.exit(1);
  }

  const validCountries = ["br", "us", "ca", "ar", "cl", "mx", "co", "pe", "pt", "es", "gb", "de", "fr"];
  if (args.country && !validCountries.includes(args.country)) {
    console.error(`❌ --country inválido. Valores válidos: ${validCountries.join(", ")}`);
    process.exit(1);
  }

  return args as ValidatedArgs;
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

  const validated = validateArgs({
    name: getArg("name"),
    type: getArg("type") as "isp" | "residential" | undefined,
    country: getArg("country"),
    customerId: getArg("customer-id"),
    zone: getArg("zone"),
    port: getArg("port"),
    password: getArg("password"),
    host: getArg("host") ?? "brd.superproxy.io",
    poolSize: getArg("pool-size"),
    isDefault: hasFlag("default"),
  });

  try {
    console.log(`\n🔄 Inserindo zona: ${validated.name}`);
    console.log(`   Tipo: ${validated.type}`);
    console.log(`   País: ${validated.country}`);
    console.log(`   Zona: ${validated.zone}`);
    console.log(`   Host: ${validated.host}:${validated.port}`);
    console.log(`   Pool: ${validated.poolSize ?? "N/A"}`);
    console.log(`   Default: ${validated.isDefault}`);

    // Verificar se já existe
    const [existing] = await db
      .select()
      .from(proxyZone)
      .where(eq(proxyZone.name, validated.name))
      .limit(1);

    if (existing) {
      console.error(`\n❌ Zona "${validated.name}" já existe!`);
      process.exit(1);
    }

    // Encrypt password
    const encryptedPassword = encrypt(validated.password);

    const [inserted] = await db
      .insert(proxyZone)
      .values({
        name: validated.name,
        type: validated.type,
        country: validated.country as "br",
        customerId: validated.customerId,
        zone: validated.zone,
        host: validated.host,
        port: parseInt(validated.port, 10),
        passwordEncrypted: encryptedPassword.encrypted,
        passwordIv: encryptedPassword.iv,
        passwordTag: encryptedPassword.tag,
        poolSize: validated.poolSize ? parseInt(validated.poolSize, 10) : undefined,
        isDefault: validated.isDefault,
        status: "active",
      })
      .returning();

    if (!inserted) {
      console.error("\n❌ Falha ao inserir zona");
      process.exit(1);
    }

    console.log(`\n✅ Zona inserida com sucesso!`);
    console.log(`   ID: ${inserted.id}`);
    console.log(`   Nome: ${inserted.name}`);

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Erro ao inserir zona:", error);
    process.exit(1);
  }
}

void main();
