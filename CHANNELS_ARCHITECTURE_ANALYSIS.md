# Channels Architecture - Technical Analysis & Refactoring Plan

**Date:** 2025-11-14
**Status:** Architecture Review Complete
**Next Steps:** Implementation Phase

---

## Executive Summary

### Current State
- **Architecture Maturity:** 60% production-ready
- **Primary Integration:** Baileys (unofficial WhatsApp Web client)
- **Scalability:** Limited to single worker instance
- **Security:** Socket.io lacks authentication
- **Multi-tenancy:** Excellent (database-per-tenant)

### Verdict
**Refactoring recommended before chat/messages module development.**

### Critical Findings
- ✅ **Excellent:** Multi-tenant DB architecture, database-backed auth state, type safety
- ❌ **Critical:** In-memory sessions prevent horizontal scaling
- ❌ **Critical:** No message event handlers (can't receive messages)
- ❌ **Critical:** Socket.io has no authentication
- ⚠️ **High Priority:** No exponential backoff (WhatsApp ban risk)
- ⚠️ **High Priority:** Aggressive DB writes on key updates

---

## Table of Contents

1. [Current Architecture Analysis](#1-current-architecture-analysis)
2. [Chatwoot Benchmark](#2-chatwoot-benchmark)
3. [Scalability Assessment](#3-scalability-assessment)
4. [Refactoring Plan](#4-refactoring-plan)
5. [Implementation Roadmap](#5-implementation-roadmap)

---

## 1. Current Architecture Analysis

### 1.1 Database Schema

**File:** `packages/db/src/schema/tenant/channels/channel.ts`

#### Strengths
- ✅ Clean multi-tenant design with `organizationId` isolation
- ✅ Smart JSONB storage for `authState` (Baileys credentials + keys)
- ✅ Proper indexing strategy
- ✅ UUID v7 for primary keys (time-ordered, distributed-friendly)
- ✅ QR code expiration tracking

#### Issues
- ❌ Missing `lastMessageAt`, `messageCount`, `connectionAttempts` fields
- ❌ Missing composite index on `(organizationId, isActive, status)`
- ⚠️ `authState` contains sensitive crypto keys but no encryption flag
- ⚠️ No `providerType` field for multi-provider support

#### Recommended Schema Updates
```typescript
export const channel = pgTable("channel", {
  // ... existing fields

  // NEW FIELDS
  providerType: varchar("provider_type", { length: 50 })
    .notNull()
    .default("baileys"), // "baileys" | "cloud_api" | "twilio"

  providerConfig: jsonb("provider_config").$type<{
    // Baileys: empty
    // Cloud API: { apiKey, phoneNumberId, businessAccountId }
    [key: string]: unknown;
  }>(),

  lastMessageAt: timestamp("last_message_at"),
  messageCount: integer("message_count").default(0),
  connectionAttempts: integer("connection_attempts").default(0),
});

// NEW INDEX
CREATE INDEX channel_active_status_idx
ON channel(organization_id, is_active, status);
```

---

### 1.2 tRPC Router Analysis

**File:** `packages/api/src/router/channels.ts`

#### Strengths
- ✅ Strong security: Never returns `authState` to clients
- ✅ Proper error handling with typed TRPC errors
- ✅ Validation with Zod schemas
- ✅ Queue-based async processing

#### Issues
- ❌ **Race condition in `create` mutation (lines 126-130)**
  - Channel created in DB
  - Queue job enqueued
  - If worker processes job BEFORE DB transaction commits → job fails
  - **Fix:** Add transaction coordination or job delay

- ❌ **Incomplete TODOs:**
  - Line 301: QR regeneration not implemented
  - Line 332: Real connection check not implemented

- ❌ **Missing rate limiting on `sendTestMessage`**
  - No protection against spam/abuse
  - WhatsApp has strict rate limits → ban risk

- ❌ **Phone number validation issue (line 350)**
  - Regex allows optional `+`
  - Should normalize before sending to WhatsApp

---

### 1.3 Worker Implementation

**File:** `apps/worker/src/workers/channel-sessions.ts`

#### Strengths
- ✅ In-memory session Map for fast lookups
- ✅ Proper session lifecycle (start/stop/send)
- ✅ Graceful restart on duplicate sessions
- ✅ Session restoration from DB state

#### Critical Issues

**1. SEVERE: In-memory sessions NOT shared across workers (line 25)**
```typescript
const activeSessions = new Map<string, BaileysSessionManager>();
// ❌ If multiple worker instances run, each has separate Map
// ❌ Message routing becomes unpredictable
// ❌ QR codes might generate on Worker 1 but client connects to Worker 2
```

**Impact:** Architecture flaw for horizontal scaling

**2. Missing: getMessage callback (Baileys best practice)**
- Required for message history and external message retrieval
- Without it, Baileys can't retrieve messages from database
- **Critical for chat module**

**3. Incomplete: restoreActiveSessions (lines 202-221)**
- Marked as TODO
- Sessions don't auto-reconnect on worker restart
- User must manually trigger reconnection

**4. Missing: Event handlers for incoming messages**
```typescript
// MISSING:
this.socket.ev.on('messages.upsert', async ({ messages }) => {
  // Save to database
  // Broadcast to UI
});

this.socket.ev.on('messages.update', async (updates) => {
  // Update delivery status
});
```

**5. Wait timeout too long (line 238)**
- 30 second default timeout for connection
- Should be configurable
- Production should fail faster

---

### 1.4 Baileys Service

**File:** `apps/worker/src/services/baileys/index.ts`

#### Strengths
- ✅ Excellent connection promise pattern
- ✅ Smart QR expiration calculation
- ✅ Redis pub/sub for real-time events
- ✅ Proper disconnect reason handling
- ✅ Auto-reconnect logic
- ✅ Explicit WhatsApp version (prevents 428 errors)

#### Critical Issues

**1. MISSING: getMessage callback in socket config (line 63)**
```typescript
this.socket = makeWASocket({
  // ... existing config

  // MISSING:
  getMessage: async (key) => {
    return await getMessageFromDatabase(key);
  }
});
```

**2. Auto-reconnect without backoff (line 176)**
```typescript
// CURRENT (DANGEROUS):
if (shouldReconnect) {
  await this.start(); // ❌ Immediate reconnection
}

// SHOULD BE:
if (shouldReconnect) {
  const delay = Math.min(1000 * Math.pow(2, attempts), 60000);
  await sleep(delay);
  await this.start();
}
```
**Impact:** Can cause WhatsApp ban for aggressive reconnection

**3. No message handling events registered**
- Missing `messages.upsert`
- Missing `messages.update`
- Missing `contacts.update`
- Missing `chats.update`
- **All required for chat module**

**4. No retry counter cache**
- Baileys documentation warns: "implement message retry counter cache"
- Missing entirely
- Can cause decryption failures

---

### 1.5 Auth State Management

**File:** `apps/worker/src/services/baileys/auth-state.ts`

#### Strengths
- ✅ Excellent database-backed auth state (no local files!)
- ✅ Proper Buffer serialization with BufferJSON
- ✅ Immediate credential save on init
- ✅ Transactional key updates

#### Issues

**1. Database write on EVERY key update (line 154)**
```typescript
// Baileys updates keys frequently during active sessions
keys.set() → DB write (10-50 times per minute!)
```
**Impact:** Performance bottleneck

**Solution:** Batch updates with write-behind cache
```typescript
// Collect updates
Object.assign(pendingKeyUpdates, data);

// Debounce writes (1 second)
setTimeout(() => flushKeyUpdates(), 1000);
```

**2. No error recovery**
- If DB write fails during `saveCreds()`, no retry
- Keys can become out of sync

**3. Missing auth state versioning**
- No version field in authState JSONB
- Can't detect incompatible auth formats

**4. No concurrency protection**
- Two workers could load same channel simultaneously
- Race condition on auth state updates
- **Need distributed lock (Redis)**

---

### 1.6 Socket.io Server

**Files:**
- `apps/server/src/socket/index.ts`
- `apps/server/src/socket/redis-pubsub.ts`

#### Strengths
- ✅ Clean room-based architecture (org rooms + channel rooms)
- ✅ Redis pub/sub for worker-to-client communication
- ✅ Proper CORS configuration
- ✅ Auto-resubscribe on reconnection
- ✅ Graceful shutdown handling

#### Critical Issues

**1. No authentication/authorization**
```typescript
socket.on('join:organization', (organizationId: string) => {
  // ❌ Any client can join any organization room
  // ❌ No session validation
  // ❌ No JWT verification
  socket.join(`org:${organizationId}`);
});
```
**Impact:** SEVERE security vulnerability

**2. Missing rate limiting**
- Clients can spam join/leave events
- No connection throttling
- DDoS vector

**3. No room validation**
- Clients can join rooms for organizations they don't belong to
- Need to verify `socket.userId` belongs to `organizationId`

**4. Redis pub/sub single point of failure**
- If Redis goes down, all real-time updates stop
- No fallback mechanism

---

### 1.7 Redis/Queue Architecture

**Files:**
- `apps/server/src/libs/queue/client.ts`
- `apps/worker/src/libs/queue/workers.ts`

#### Strengths
- ✅ Lazy initialization pattern
- ✅ Proper job retry configuration (exponential backoff)
- ✅ Job retention policies
- ✅ BullMQ worker concurrency control

#### Issues

**1. Single Redis instance for everything**
- Queue jobs
- Pub/sub
- Session registry (future)
- **Single point of failure**

**Recommendation:** Separate Redis instances by concern
```typescript
const queueRedis = new Redis(env.QUEUE_REDIS_URL);
const pubsubRedis = new Redis(env.PUBSUB_REDIS_URL);
const cacheRedis = new Redis(env.CACHE_REDIS_URL);
```

**2. No queue monitoring**
- No metrics on queue depth
- No alerts on job failures
- No visibility into processing times

**3. Missing job priorities**
- All jobs treated equally
- Message sending should be higher priority than QR generation

**4. No dead letter queue**
- Jobs that fail 3 times are just marked as failed
- No mechanism to review/replay
- Lost messages in chat module would be catastrophic

---

## 2. Chatwoot Benchmark

### 2.1 Does Chatwoot Use Baileys?

**NO.** Chatwoot does NOT use Baileys in production.

**They use:**
1. **WhatsApp Cloud API** (Meta's official API)
2. **360Dialog API** (WhatsApp Business API provider)

### 2.2 Why They Avoid Baileys

- ❌ Unofficial library (no SLA)
- ❌ High ban risk from WhatsApp
- ❌ No customer support from Meta
- ❌ Scaling challenges
- ❌ Session management complexity

### 2.3 Tech Stack Comparison

| Component | Chatwoot | Current Implementation |
|-----------|----------|------------------------|
| **Language** | Ruby on Rails | TypeScript/Node.js |
| **WhatsApp** | Meta Cloud API | Baileys (Web scraping) |
| **Queue** | Sidekiq (Redis) | BullMQ (Redis) |
| **Real-time** | ActionCable | Socket.io |
| **Database** | PostgreSQL (single) | PostgreSQL (multi-tenant) |
| **Multi-tenancy** | Row-level | Database-per-tenant |

### 2.4 Chatwoot Architecture

#### Multi-Tenancy: Account-Based (Row-Level Isolation)

```ruby
# Single Database
accounts (tenant identifier)
  └── inboxes (account_id FK)
      └── channel_whatsapp (polymorphic)
          ├── provider ("whatsapp_cloud" | "360dialog")
          └── provider_config (JSONB)

# Every query: WHERE account_id = ?
```

**Advantages:**
- Simple
- Works for SMBs

**Disadvantages:**
- Noisy neighbor problem
- Limited isolation
- Single DB bottleneck

#### Provider Strategy Pattern

```ruby
class Channel::Whatsapp
  def provider_service
    if provider == 'whatsapp_cloud'
      Whatsapp::Providers::WhatsappCloudService.new(self)
    else
      Whatsapp::Providers::Whatsapp360DialogService.new(self)
    end
  end

  # Delegate operations to provider
  delegate :send_message, :send_template, to: :provider_service
end
```

**Key Learning:** Abstract providers behind common interface

### 2.5 Message Sending Comparison

#### Chatwoot: Meta Cloud API

```ruby
def send_message(phone_number, message)
  HTTParty.post(
    "#{BASE_URL}/#{phone_number_id}/messages",
    headers: {
      "Authorization" => "Bearer #{api_key}",
      "Content-Type" => "application/json"
    },
    body: {
      messaging_product: "whatsapp",
      to: phone_number,
      type: "text",
      text: { body: message }
    }.to_json
  )
end
```

**Features:**
- ✅ Official API (stable, supported)
- ✅ Message templates for marketing
- ✅ Business-verified sender
- ✅ Message IDs for tracking
- ✅ Delivery receipts
- ✅ Read receipts
- ❌ Costs money (conversation-based pricing)

#### Current: Baileys

```typescript
async sendMessage(to: string, text: string) {
  const jid = `${phoneNumber}@s.whatsapp.net`;
  await this.socket.sendMessage(jid, { text });
}
```

**Features:**
- ✅ Free (no API costs)
- ✅ QR code login
- ✅ Works like personal WhatsApp
- ❌ Unofficial (can break)
- ❌ No templates
- ❌ Risk of ban
- ❌ No scalability

### 2.6 Incoming Messages: Webhooks vs Events

#### Chatwoot: Meta Webhooks

```ruby
# Webhook endpoint
POST /webhooks/whatsapp/:phone_number

# Async processing
Webhooks::WhatsappEventsJob.perform_later(params)

# Service processes webhook
class Whatsapp::IncomingMessageWhatsappCloudService
  def perform
    # 1. Find or create contact
    # 2. Find or create conversation
    # 3. Create message
    # 4. Download attachments
  end
end
```

**Webhook Payload:**
```json
{
  "entry": [{
    "changes": [{
      "value": {
        "messages": [{
          "from": "5521984848843",
          "id": "wamid.xxx",
          "type": "text",
          "text": { "body": "Hello!" }
        }]
      }
    }]
  }]
}
```

#### Current: Baileys Events

```typescript
// ❌ No webhook support
// Events only in worker process
// No external integrations possible

this.socket.ev.on("messages.upsert", async (m) => {
  // TODO: Implement
});
```

### 2.7 Session Management

#### Chatwoot: Stateless

```ruby
# No session management needed!
# Just store credentials
provider_config: {
  api_key: "EAAG...",  # Long-lived token
  phone_number_id: "123"
}
```

**Advantages:**
- ✅ No persistent connections
- ✅ Works across server restarts
- ✅ Horizontal scaling (stateless)
- ✅ No QR code regeneration
- ✅ No session timeout issues

#### Current: Stateful (Baileys)

```typescript
const activeSessions = new Map<string, BaileysSessionManager>();

// ❌ Sessions lost on worker restart
// ❌ Manual reconnection needed
// ❌ Can't query catalog DB for all orgs
// ❌ Single worker bottleneck
```

### 2.8 Scaling Architecture

#### Chatwoot

```
┌────────────┐  ┌────────────┐  ┌────────────┐
│  Rails 1   │  │  Rails 2   │  │  Rails 3   │
│ (Stateless)│  │ (Stateless)│  │ (Stateless)│
└────────────┘  └────────────┘  └────────────┘
      │               │               │
      └───────────────┼───────────────┘
                      │
              ┌───────▼────────┐
              │  Load Balancer │
              └────────────────┘

✅ Horizontal scaling easy
✅ Add more Rails instances
✅ No session affinity needed
```

#### Current

```
┌────────────────┐
│   API Server   │  ✅ Stateless
└────────────────┘
        │
        ▼
┌────────────────┐
│  Worker 1      │  ❌ STATEFUL
│  ├─ Session A  │  (Baileys connections)
│  ├─ Session B  │
│  └─ Session C  │
└────────────────┘

❌ Cannot add Worker 2!
❌ Sessions not shared
```

### 2.9 Feature Comparison

| Feature | Chatwoot | Current | Winner |
|---------|----------|---------|--------|
| **Integration** | Official Cloud API | Unofficial Baileys | 🏆 Chatwoot |
| **Setup** | OAuth flow | QR scan | 🏆 Chatwoot |
| **Reliability** | High | Medium | 🏆 Chatwoot |
| **Cost** | Paid | Free | 🏆 Current |
| **Templates** | ✅ Yes | ❌ No | 🏆 Chatwoot |
| **Webhooks** | ✅ Native | ❌ Manual | 🏆 Chatwoot |
| **Scaling** | ✅ Easy | ❌ Hard | 🏆 Chatwoot |
| **Session Mgmt** | Stateless | Stateful | 🏆 Chatwoot |
| **Multi-tenant** | Row-level | DB-per-tenant | 🔄 Tie |
| **Type Safety** | Ruby | TypeScript | 🏆 Current |
| **Real-time** | ActionCable | Socket.io | 🔄 Tie |

### 2.10 Key Patterns to Adopt from Chatwoot

**1. Provider Abstraction Pattern**
```typescript
interface WhatsAppProvider {
  sendMessage(to: string, text: string): Promise<string>;
  sendTemplate(to: string, template: Template): Promise<string>;
}

class BaileysProvider implements WhatsAppProvider { }
class CloudAPIProvider implements WhatsAppProvider { }

// Channel decides which provider
const provider = channel.getProvider();
await provider.sendMessage(to, text);
```

**2. Webhook-First Architecture**
- Receive webhooks from Meta
- Queue for async processing
- Store messages in database
- Broadcast to UI

**3. Conversation Management**
- Group messages into conversations
- Track conversation status (open/resolved/pending)
- Assign to users

**4. Event-Driven Updates**
- Emit events from models
- Listeners subscribe
- Decouple components

---

## 3. Scalability Assessment

### 3.1 Current Bottlenecks

| Bottleneck | Location | Impact | Priority |
|------------|----------|--------|----------|
| **In-memory sessions** | `channel-sessions.ts:25` | Cannot scale workers | P0 |
| **DB writes per key update** | `auth-state.ts:154` | 10-50 writes/min | P1 |
| **Single Redis** | Throughout | Redis bottleneck | P2 |
| **No connection pooling** | TenantDatabaseManager | Connection explosion | P1 |

### 3.2 Current Limits

| Metric | Current Limit | Reasoning |
|--------|---------------|-----------|
| Concurrent channels | ~100 per worker | In-memory sessions, DB writes |
| Messages/second | ~50 | Database bottleneck |
| Worker instances | 1 (forced) | Session registry not distributed |
| Organizations | Unlimited | Good multi-tenant design |

### 3.3 After Refactoring

| Metric | Projected Limit | Changes Required |
|--------|-----------------|------------------|
| Concurrent channels | ~1000 per worker | Redis session registry |
| Messages/second | ~500 | Batch writes, pooling |
| Worker instances | 10+ | Distributed sessions |
| Organizations | Unlimited | No changes |

---

## 4. Refactoring Plan

### Phase 1: File Structure & Shared Code (2-3 days)

#### 1.1 Create `packages/shared`

```
packages/shared/
├── src/
│   ├── types/
│   │   ├── channel.ts       # Channel, Session types
│   │   ├── provider.ts      # Provider types
│   │   └── message.ts       # Message types (future)
│   ├── constants/
│   │   ├── status.ts        # Channel status enums
│   │   ├── limits.ts        # Rate limits, timeouts
│   │   └── providers.ts     # Provider types enum
│   └── utils/
│       ├── phone.ts         # Phone normalization
│       └── validation.ts    # Common validators
├── package.json
└── tsconfig.json
```

#### 1.2 Create `packages/whatsapp` (Provider Abstraction)

```
packages/whatsapp/
├── src/
│   ├── providers/
│   │   ├── base.ts          # WhatsAppProvider interface
│   │   ├── baileys.ts       # BaileysProvider
│   │   ├── cloud-api.ts     # CloudAPIProvider (future)
│   │   └── factory.ts       # WhatsAppProviderFactory
│   └── index.ts
├── package.json
└── tsconfig.json
```

**Provider Interface:**
```typescript
export interface WhatsAppProvider {
  sendMessage(to: string, input: SendMessageInput): Promise<SendMessageResult>;
  sendTemplate(to: string, template: TemplateInput): Promise<SendMessageResult>;
  getTemplates(): Promise<Template[]>;
  validateConfig(): Promise<boolean>;
  setupWebhook?(url: string, token: string): Promise<void>;
}
```

#### 1.3 Reorganize `apps/worker/src`

```
apps/worker/src/
├── workers/
│   └── channel-sessions.ts
├── services/
│   ├── baileys/
│   │   ├── index.ts
│   │   ├── auth-state.ts
│   │   └── event-subscriber.ts
│   ├── registry/             # NEW
│   │   └── distributed-registry.ts
│   └── queue/                # NEW
│       └── worker-utils.ts
└── types/                    # NEW
    └── worker.ts
```

#### 1.4 Reorganize `apps/server/src/socket`

```
apps/server/src/socket/
├── handlers/                 # NEW
│   ├── channel.ts           # join:channel, leave:channel
│   ├── organization.ts      # join:organization, leave:organization
│   └── index.ts             # Export all handlers
├── middleware/               # NEW
│   ├── auth.ts              # Authentication middleware
│   └── validation.ts        # Room validation
├── index.ts
├── redis-pubsub.ts
└── types.ts
```

#### 1.5 Update Database Schema

```typescript
// Add fields to channel table
export const channel = pgTable("channel", {
  // ... existing fields

  // Provider abstraction
  providerType: varchar("provider_type", { length: 50 })
    .notNull()
    .default("baileys"),

  providerConfig: jsonb("provider_config"),

  // Operational fields
  lastMessageAt: timestamp("last_message_at"),
  messageCount: integer("message_count").default(0),
  connectionAttempts: integer("connection_attempts").default(0),
});

// Add index
CREATE INDEX channel_active_status_idx
ON channel(organization_id, is_active, status);
```

---

### Phase 2: Provider Abstraction (3-4 days)

#### 2.1 Implement Base Provider Interface

```typescript
// packages/whatsapp/src/providers/base.ts
export interface WhatsAppProvider {
  sendMessage(to: string, input: SendMessageInput): Promise<SendMessageResult>;
  sendTemplate(to: string, template: TemplateInput): Promise<SendMessageResult>;
  getTemplates(): Promise<Template[]>;
  validateConfig(): Promise<boolean>;
}

export interface SendMessageInput {
  text?: string;
  media?: {
    type: "image" | "video" | "document" | "audio";
    url: string;
    caption?: string;
  };
}

export interface SendMessageResult {
  messageId: string;
  timestamp: Date;
}
```

#### 2.2 Implement BaileysProvider

```typescript
// packages/whatsapp/src/providers/baileys.ts
export class BaileysProvider implements WhatsAppProvider {
  constructor(private session: BaileysSessionManager) {}

  async sendMessage(to: string, input: SendMessageInput) {
    if (input.text) {
      await this.session.sendMessage(to, input.text);
    }

    return {
      messageId: `baileys_${Date.now()}`,
      timestamp: new Date(),
    };
  }

  async sendTemplate() {
    throw new Error("Baileys doesn't support templates");
  }

  async getTemplates() {
    return [];
  }

  async validateConfig() {
    return this.session.isSessionConnected();
  }
}
```

#### 2.3 Implement Provider Factory

```typescript
// packages/whatsapp/src/providers/factory.ts
export class WhatsAppProviderFactory {
  static create(channel: Channel): WhatsAppProvider {
    switch (channel.providerType) {
      case "baileys":
        const session = BaileysSessionManager.get(channel.id);
        return new BaileysProvider(session);

      case "cloud_api":
        return new CloudAPIProvider(channel.providerConfig);

      default:
        throw new Error(`Unknown provider: ${channel.providerType}`);
    }
  }
}
```

#### 2.4 Update tRPC Router

```typescript
// packages/api/src/router/channels.ts
import { WhatsAppProviderFactory } from "@manylead/whatsapp";

channelsRouter = createTRPCRouter({
  sendMessage: ownerProcedure
    .input(z.object({
      channelId: z.uuid(),
      to: z.string(),
      text: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [channel] = await ctx.tenantDb
        .select()
        .from(channel)
        .where(eq(channel.id, input.channelId));

      if (!channel) throw new Error("Channel not found");

      // Use provider abstraction
      const provider = WhatsAppProviderFactory.create(channel);
      const result = await provider.sendMessage(input.to, {
        text: input.text,
      });

      return result;
    }),
});
```

---

### Phase 3: Distributed Session Registry (2 days)

#### 3.1 Implement DistributedSessionRegistry

```typescript
// apps/worker/src/services/registry/distributed-registry.ts
import Redis from "ioredis";

export class DistributedSessionRegistry {
  constructor(
    private redis: Redis,
    private workerId: string
  ) {}

  async registerSession(channelId: string): Promise<void> {
    // Register in Redis hash
    await this.redis.hset(
      "sessions:registry",
      channelId,
      this.workerId
    );

    // Set heartbeat with TTL
    await this.redis.setex(
      `session:${channelId}:heartbeat`,
      60,
      Date.now().toString()
    );
  }

  async getSessionWorker(channelId: string): Promise<string | null> {
    // Check if session exists
    const workerId = await this.redis.hget(
      "sessions:registry",
      channelId
    );

    if (!workerId) return null;

    // Check if heartbeat is recent
    const heartbeat = await this.redis.get(
      `session:${channelId}:heartbeat`
    );

    if (!heartbeat) {
      // Stale session, remove it
      await this.unregisterSession(channelId);
      return null;
    }

    return workerId;
  }

  async unregisterSession(channelId: string): Promise<void> {
    await this.redis.hdel("sessions:registry", channelId);
    await this.redis.del(`session:${channelId}:heartbeat`);
  }

  async acquireLock(channelId: string, ttl: number = 30): Promise<boolean> {
    const result = await this.redis.set(
      `lock:channel:${channelId}`,
      this.workerId,
      "NX", // Only if not exists
      "EX", // Expire
      ttl
    );

    return result === "OK";
  }

  async releaseLock(channelId: string): Promise<void> {
    const currentLock = await this.redis.get(`lock:channel:${channelId}`);
    if (currentLock === this.workerId) {
      await this.redis.del(`lock:channel:${channelId}`);
    }
  }

  async updateHeartbeat(channelId: string): Promise<void> {
    await this.redis.setex(
      `session:${channelId}:heartbeat`,
      60,
      Date.now().toString()
    );
  }
}
```

#### 3.2 Update Channel Sessions Worker

```typescript
// apps/worker/src/workers/channel-sessions.ts
import { DistributedSessionRegistry } from "../services/registry/distributed-registry";

const WORKER_ID = `worker_${process.pid}_${Date.now()}`;
const registry = new DistributedSessionRegistry(redis, WORKER_ID);

// Keep local Map for fast access
const activeSessions = new Map<string, BaileysSessionManager>();

export async function getOrCreateSession(
  channelId: string,
  organizationId: string
): Promise<BaileysSessionManager> {
  // Check local cache first
  let session = activeSessions.get(channelId);
  if (session) return session;

  // Acquire distributed lock
  const lockAcquired = await registry.acquireLock(channelId);
  if (!lockAcquired) {
    throw new Error(`Channel ${channelId} is locked by another worker`);
  }

  try {
    // Check if session exists on another worker
    const existingWorker = await registry.getSessionWorker(channelId);
    if (existingWorker && existingWorker !== WORKER_ID) {
      throw new Error(
        `Session already active on worker ${existingWorker}`
      );
    }

    // Create new session
    session = new BaileysSessionManager(channelId, organizationId);
    await session.start();

    // Register in distributed registry
    await registry.registerSession(channelId);

    // Store in local cache
    activeSessions.set(channelId, session);

    // Start heartbeat
    startHeartbeat(channelId);

    return session;
  } finally {
    await registry.releaseLock(channelId);
  }
}

function startHeartbeat(channelId: string) {
  const interval = setInterval(async () => {
    const session = activeSessions.get(channelId);
    if (!session || !session.isSessionConnected()) {
      clearInterval(interval);
      await registry.unregisterSession(channelId);
      activeSessions.delete(channelId);
      return;
    }

    await registry.updateHeartbeat(channelId);
  }, 30000); // Every 30 seconds
}
```

---

### Phase 4: Security & Stability (2-3 days)

#### 4.1 Socket.io Authentication

```typescript
// apps/server/src/socket/middleware/auth.ts
import { Socket } from "socket.io";
import { validateSessionToken } from "@manylead/auth";

export async function authMiddleware(
  socket: Socket,
  next: (err?: Error) => void
) {
  const token = socket.handshake.auth.token;

  if (!token) {
    return next(new Error("No authentication token"));
  }

  try {
    const session = await validateSessionToken(token);

    socket.data.userId = session.userId;
    socket.data.organizationIds = session.organizationIds;

    next();
  } catch (error) {
    next(new Error("Invalid token"));
  }
}
```

```typescript
// apps/server/src/socket/index.ts
import { authMiddleware } from "./middleware/auth";

io.use(authMiddleware);

// Validate organization membership
socket.on("join:organization", (organizationId: string) => {
  if (!socket.data.organizationIds.includes(organizationId)) {
    socket.emit("error", { message: "Unauthorized" });
    return;
  }

  socket.join(`org:${organizationId}`);
  socket.emit("joined:organization", { organizationId });
});
```

#### 4.2 Exponential Backoff

```typescript
// apps/worker/src/services/baileys/index.ts
export class BaileysSessionManager {
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;

  private async handleConnectionUpdate(update: any) {
    const { connection, lastDisconnect } = update;

    if (connection === "close") {
      this.isConnected = false;
      const shouldReconnect = this.shouldReconnect(lastDisconnect);

      if (shouldReconnect) {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          await this.publishEvent("channel:error", {
            error: "Max reconnection attempts exceeded",
            status: "error",
          });
          return;
        }

        // Exponential backoff: 1s, 2s, 4s, 8s, ..., max 60s
        const delay = Math.min(
          1000 * Math.pow(2, this.reconnectAttempts),
          60000
        );
        this.reconnectAttempts++;

        logger.info({
          channelId: this.channelId,
          delay,
          attempt: this.reconnectAttempts,
        }, "[Baileys] Reconnecting with exponential backoff");

        await new Promise((resolve) => setTimeout(resolve, delay));
        await this.start();
      }
    }

    if (connection === "open") {
      this.isConnected = true;
      this.reconnectAttempts = 0; // Reset on successful connection
      // ... rest of connection logic
    }
  }
}
```

#### 4.3 Batch Auth State Writes

```typescript
// apps/worker/src/services/baileys/auth-state.ts
let pendingWrites: any = null;
let writeTimeout: NodeJS.Timeout | null = null;

const scheduleWrite = () => {
  if (writeTimeout) clearTimeout(writeTimeout);

  writeTimeout = setTimeout(async () => {
    if (pendingWrites) {
      await tenantDb
        .update(channel)
        .set({
          authState: {
            creds: JSON.parse(JSON.stringify(creds, BufferJSON.replacer)),
            keys: pendingWrites,
          },
          updatedAt: new Date(),
        })
        .where(eq(channel.id, channelId));

      pendingWrites = null;
      logger.info({ channelId }, "[AuthState] Flushed batched writes");
    }
  }, 1000); // Batch writes for 1 second
};

const keys = {
  set: async (data: any) => {
    for (const category in data) {
      for (const id in data[category]) {
        const key = `${category}-${id}`;
        const value = data[category][id];

        if (!pendingWrites) {
          pendingWrites = { ...keysData };
        }

        if (value === null) {
          delete pendingWrites[key];
        } else {
          pendingWrites[key] = value;
        }
      }
    }

    scheduleWrite();
  }
};
```

---

### Phase 5: Observability (1-2 days)

#### 5.1 Health Check Endpoint

```typescript
// packages/api/src/router/channels.ts
channelsRouter = createTRPCRouter({
  getHealth: ownerProcedure
    .query(async ({ ctx }) => {
      const channels = await ctx.tenantDb
        .select({
          total: sql<number>`count(*)`,
          active: sql<number>`count(*) filter (where status = 'connected')`,
          connecting: sql<number>`count(*) filter (where status = 'pending')`,
          error: sql<number>`count(*) filter (where status = 'error')`,
        })
        .from(channel)
        .where(eq(channel.organizationId, ctx.organizationId));

      const queueMetrics = await getQueueMetrics();

      return {
        channels: channels[0],
        queue: queueMetrics,
      };
    }),

  getSessionHealth: ownerProcedure
    .input(z.object({ id: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const [ch] = await ctx.tenantDb
        .select()
        .from(channel)
        .where(eq(channel.id, input.id));

      if (!ch) throw new Error("Channel not found");

      // Check Redis registry
      const workerId = await registry.getSessionWorker(input.id);

      return {
        channelId: input.id,
        status: ch.status,
        isActive: ch.isActive,
        workerId: workerId,
        lastConnectedAt: ch.lastConnectedAt,
        connectionAttempts: ch.connectionAttempts,
        messageCount: ch.messageCount,
      };
    }),
});
```

```typescript
// Helper function
async function getQueueMetrics() {
  const queue = getChannelSessionsQueue();

  const [waiting, active, completed, failed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    depth: waiting + active,
  };
}
```

---

## 5. Implementation Roadmap

### Timeline: 10-14 days

```
Week 1:
├── Day 1-2: Phase 1 - File Structure
│   ├── Create packages/shared
│   ├── Create packages/whatsapp
│   ├── Reorganize worker files
│   └── Reorganize socket files
│
├── Day 3-4: Phase 2 - Provider Abstraction
│   ├── Implement base interface
│   ├── Implement BaileysProvider
│   ├── Implement factory
│   └── Update tRPC router
│
└── Day 5: Phase 3 - Distributed Registry (Part 1)
    ├── Implement DistributedSessionRegistry
    └── Add distributed locks

Week 2:
├── Day 6: Phase 3 - Distributed Registry (Part 2)
│   ├── Update channel-sessions worker
│   └── Implement heartbeat mechanism
│
├── Day 7-8: Phase 4 - Security & Stability
│   ├── Socket.io authentication
│   ├── Exponential backoff
│   └── Batch auth state writes
│
└── Day 9-10: Phase 5 - Observability & Testing
    ├── Health check endpoints
    ├── Session health checks
    ├── Integration testing
    └── Documentation
```

### Success Criteria

**Phase 1:**
- ✅ `packages/shared` builds and exports types
- ✅ `packages/whatsapp` builds and exports interfaces
- ✅ Worker files organized in new structure
- ✅ Socket files organized with middleware

**Phase 2:**
- ✅ WhatsAppProvider interface implemented
- ✅ BaileysProvider wraps existing code
- ✅ Factory creates correct provider
- ✅ tRPC uses provider abstraction

**Phase 3:**
- ✅ Redis stores session registry
- ✅ Multiple workers can run simultaneously
- ✅ Sessions distributed across workers
- ✅ Heartbeat prevents stale sessions

**Phase 4:**
- ✅ Socket.io requires authentication
- ✅ Reconnection uses exponential backoff
- ✅ Auth state writes batched (1-2/min vs 10-50/min)

**Phase 5:**
- ✅ Health check returns accurate metrics
- ✅ Session health shows worker assignment
- ✅ All tests passing

---

## 6. Risk Mitigation

### Risk: Baileys Ban

**Mitigation:**
1. Implement rate limiting
2. Exponential backoff (done in Phase 4)
3. Monitor for 428 errors
4. Provider abstraction allows Cloud API migration

### Risk: Redis Failure

**Mitigation:**
1. Graceful degradation (use local Map if Redis down)
2. Document Redis as critical dependency
3. Monitor Redis health
4. Consider Redis Sentinel for HA (future)

### Risk: Worker Crashes

**Mitigation:**
1. Sessions auto-expire via TTL
2. Heartbeat mechanism detects dead workers
3. New worker can pick up abandoned sessions
4. Graceful shutdown handling

### Risk: Database Connection Pool

**Mitigation:**
1. Implement connection pooling per tenant
2. Monitor connection counts
3. Set max connections limit
4. Close idle connections

---

## 7. Post-Refactoring Benefits

### Before Refactoring

| Metric | Value |
|--------|-------|
| Max workers | 1 |
| Channels/worker | ~100 |
| Worker restart impact | All sessions lost |
| Socket.io security | None |
| DB writes/min (active session) | 10-50 |
| Reconnection strategy | Immediate |
| Provider flexibility | None |

### After Refactoring

| Metric | Value |
|--------|-------|
| Max workers | 10+ |
| Channels/worker | ~1000 |
| Worker restart impact | Minimal (Redis registry) |
| Socket.io security | JWT authentication |
| DB writes/min (active session) | 1-2 |
| Reconnection strategy | Exponential backoff |
| Provider flexibility | Easy to add Cloud API |

---

## 8. Future Enhancements

### Short-term (Post-Refactoring)

1. **Message Storage**
   - Create messages table
   - Link to channels
   - Store incoming/outgoing messages

2. **Conversation Management**
   - Group messages into conversations
   - Track status (open/resolved)
   - Assign to users

3. **Webhook Support**
   - Receive Meta webhooks
   - Process asynchronously
   - Emit to Socket.io

### Medium-term

1. **Cloud API Integration**
   - Implement CloudAPIProvider
   - OAuth flow for setup
   - Template management
   - Webhook handling

2. **Rate Limiting**
   - Per-channel limits
   - Per-organization limits
   - WhatsApp official limits

3. **Analytics**
   - Message counts
   - Response times
   - Channel health metrics

### Long-term

1. **Multi-Provider Support**
   - Twilio
   - 360Dialog
   - Other WhatsApp BSPs

2. **High Availability**
   - Redis Sentinel
   - Database replication
   - Multi-region deployment

3. **Advanced Features**
   - Chatbots
   - Auto-replies
   - Message templates
   - Broadcast lists

---

## Conclusion

The current channels architecture has a **solid foundation** but requires **critical refactoring** before building the chat/messages module.

**Strengths to maintain:**
- ✅ Multi-tenant database architecture
- ✅ Database-backed auth state
- ✅ TypeScript type safety
- ✅ Modern tech stack

**Critical issues to fix:**
- ❌ In-memory sessions (prevents scaling)
- ❌ No Socket.io authentication (security)
- ❌ Aggressive reconnection (ban risk)
- ❌ Excessive DB writes (performance)

**Estimated effort:** 10-14 days

**Result:** Production-ready, scalable, secure channels architecture prepared for chat/messages module.

---

**Next Steps:** Begin implementation starting with Phase 1.
