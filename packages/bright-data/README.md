# @manylead/bright-data

Bright Data ISP proxy integration para WhatsApp automation com IP dedicado por organização.

## Flow: Bright Data ISP Proxy

### 1. Setup Inicial (Admin)

```bash
pnpm --filter @manylead/db add-proxy-zone \
  --name "ISP Brasil" \
  --type isp \
  --country br \
  --customerId hl_b91d78ff \
  --zone manylead_isp \
  --port 22225 \
  --password SENHA_DA_ZONA \
  --poolSize 1
```

Zona salva no banco com senha criptografada (AES-256-GCM).

### 2. User Conecta Canal WhatsApp

```
channels.ts → create()
```

1. Verifica se `proxyEnabled && proxyType === "isp"`
2. Chama `ensureIspIpAvailable(country, activeOrgCount)`
   - Se `activeOrgCount >= poolSize` → adiciona IP via API Bright Data
   - Atualiza `poolSize` no banco
3. Gera `sessionId` único para a org
4. Busca config da zona no banco (decripta senha)
5. Monta `proxyConfig` com username: `brd-customer-X-zone-Y-session-Z`
6. Cria instância na Evolution API com proxy configurado

### 3. Conexão WhatsApp

```
Org → Evolution API → Bright Data ISP → WhatsApp
                      (IP dedicado via sessionId)
```

### 4. Keep-alive

- **ISP**: Desabilitado (IP dedicado não expira)
- **Residential**: Mantém sessão ativa a cada 5min

### 5. Desconectar Canal

- Remove instância da Evolution API
- Proxy fica disponível para reutilização (mesmo sessionId = mesmo IP)

## Resumo

1 org = 1 sessionId = 1 IP dedicado. IPs são adicionados automaticamente quando o pool enche.

## Variáveis de Ambiente

```env
# API Token para gerenciamento de zonas (adicionar/remover IPs)
# Obter em: https://brightdata.com/cp/setting/users → Add API key → Permission: Admin
BRIGHT_DATA_API_TOKEN="sua-api-token"
```

## Estrutura

```
src/
├── client.ts           # Cliente principal
├── config.ts           # Busca zonas do banco (cache 5min)
├── env.ts              # Validação de env vars
├── types.ts            # Tipos TypeScript
├── services/
│   └── ip-manager.ts   # Auto-scaling de IPs via API
└── utils/
    ├── proxy-builder.ts      # Monta config para Evolution API
    ├── session-manager.ts    # Gera/valida sessionId
    └── timezone-to-country.ts # Mapeia timezone → país
```

## API

### ensureIspIpAvailable

Garante que há IP disponível antes de criar canal.

```typescript
import { ensureIspIpAvailable } from "@manylead/bright-data";

const result = await ensureIspIpAvailable("br", activeOrgCount);
// { zoneId, customerId, zoneName, poolSize, newIpAdded, newIps? }
```

### buildEvolutionProxyConfig

Monta configuração de proxy para Evolution API.

```typescript
import { buildEvolutionProxyConfig, generateSessionId } from "@manylead/bright-data";

const sessionId = generateSessionId(organizationId);
const proxyConfig = await buildEvolutionProxyConfig(
  organizationId,
  { enabled: true, proxyType: "isp", country: "br", sessionId },
  "America/Sao_Paulo"
);
```

### getBrightDataConfig

Busca configuração da zona do banco.

```typescript
import { getBrightDataConfig } from "@manylead/bright-data";

const config = await getBrightDataConfig("isp", "br");
// { host, port, username, password, customerId, zone }
```
