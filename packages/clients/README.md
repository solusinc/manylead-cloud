# @manylead/clients

Centralized infrastructure client factory package for ManyLead monorepo. Provides singleton-based factories for Redis, Postgres, Queue (BullMQ), Storage (Cloudflare R2), API clients, and Logger with preset configurations and type safety.

## Features

- **Singleton Pattern**: Prevents duplicate client instances across the application
- **Preset Configurations**: Best-practice defaults for common use cases
- **Type Safety**: Full TypeScript support with Zod-validated environment variables
- **Structured Logging**: Integrated Pino logger with automatic event handlers
- **Connection Pooling**: Optimized pool sizes for different workloads
- **Graceful Shutdown**: Cleanup functions for all resources
- **Zero Breaking Changes**: Drop-in replacement for existing client code

## Installation

This package is already part of the ManyLead monorepo. Import it using workspace protocol:

```json
{
  "dependencies": {
    "@manylead/clients": "workspace:*"
  }
}
```

## Usage

### Environment Variables

All clients require environment configuration. Use the centralized env export:

```typescript
import { env } from "@manylead/clients";

// Access validated environment variables
console.log(env.REDIS_URL);
console.log(env.DATABASE_URL);
```

### Redis Client

Create Redis clients with optimized presets for different use cases.

**Available Presets:**
- `default`: General-purpose configuration
- `queue`: BullMQ optimized (maxRetriesPerRequest: null, autoPipelining)
- `pubsub`: Pub/Sub optimized (lazyConnect: true)
- `cache`: Caching optimized (enableReadyCheck: true)
- `high-latency`: High-latency network optimized (longer timeouts)

```typescript
import { createRedisClient, closeRedis } from "@manylead/clients/redis";
import { env } from "@manylead/clients";
import { logger } from "./logger";

// Create with preset
const queueRedis = createRedisClient({
  url: env.REDIS_URL,
  preset: "queue",
  logger,
});

// Create with custom config
const cacheRedis = createRedisClient({
  url: env.REDIS_URL,
  preset: "cache",
  config: {
    keyPrefix: "cache:",
  },
  logger,
});

// Cleanup on shutdown
await closeRedis();
```

**Migration Example:**

```typescript
// Before
const redis = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
  enableAutoPipelining: true,
});

// After
import { createRedisClient } from "@manylead/clients/redis";
import { env } from "@manylead/clients";

const redis = createRedisClient({
  url: env.REDIS_URL,
  preset: "queue",
});
```

### Postgres Client

Create Postgres clients with connection pooling presets.

**Available Presets:**
- `default`: General-purpose (max: 10 connections)
- `pgbouncer`: PgBouncer optimized (max: 3, prepare: false)
- `admin`: Admin operations (max: 1)
- `migration`: Migration operations (max: 1, prepare: false)
- `small-pool`: Small pool (max: 2)

```typescript
import { createPostgresClient, closePostgres } from "@manylead/clients/postgres";
import { env } from "@manylead/clients";
import { logger } from "./logger";

// Create with preset
const db = createPostgresClient({
  connectionString: env.DATABASE_URL,
  preset: "pgbouncer",
  logger,
});

// Execute queries
const users = await db`SELECT * FROM users WHERE id = ${userId}`;

// Cleanup on shutdown
await closePostgres();
```

**Migration Example:**

```typescript
// Before
import postgres from "postgres";

const db = postgres(process.env.DATABASE_URL!, {
  max: 3,
  prepare: false,
});

// After
import { createPostgresClient } from "@manylead/clients/postgres";
import { env } from "@manylead/clients";

const db = createPostgresClient({
  connectionString: env.DATABASE_URL,
  preset: "pgbouncer",
});
```

### Queue & Worker (BullMQ)

Create queues and workers with retry strategy presets.

**Available Presets:**
- `default`: General-purpose (3 attempts, 5s delay)
- `high-priority`: High-priority jobs (5 attempts, 1s delay)
- `low-priority`: Low-priority jobs (3 attempts, 7 day retention)
- `media-download`: Media download jobs (3 attempts, 5s delay, 24h retention)
- `cleanup`: Cleanup jobs (2 attempts, 30 day fail retention)

```typescript
import { createQueue, createWorker } from "@manylead/clients/queue";
import { createRedisClient } from "@manylead/clients/redis";
import { env } from "@manylead/clients";
import { logger } from "./logger";

// Create Redis connection for BullMQ
const connection = createRedisClient({
  url: env.REDIS_URL,
  preset: "queue",
});

// Create queue with preset
const emailQueue = createQueue({
  name: "email",
  connection,
  preset: "high-priority",
  logger,
});

// Add job
await emailQueue.add("send-welcome", {
  to: "user@example.com",
  template: "welcome",
});

// Create worker with auto event listeners
const emailWorker = createWorker({
  name: "email",
  connection,
  preset: "high-priority",
  concurrency: 5,
  processor: async (job) => {
    const { to, template } = job.data;
    await sendEmail(to, template);
  },
  logger, // Automatically adds completed/failed/progress event listeners
});
```

**Migration Example:**

```typescript
// Before
import { Queue, Worker } from "bullmq";

const queue = new Queue("email", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 1000 },
  },
});

const worker = new Worker("email", processor, {
  connection: redisConnection,
  concurrency: 5,
});

worker.on("completed", (job) => {
  console.log(`Job ${job.id} completed`);
});

// After
import { createQueue, createWorker } from "@manylead/clients/queue";

const queue = createQueue({
  name: "email",
  connection,
  preset: "high-priority",
  logger,
});

const worker = createWorker({
  name: "email",
  connection,
  preset: "high-priority",
  concurrency: 5,
  processor,
  logger, // Auto event listeners
});
```

### Storage Client (Cloudflare R2)

Create S3-compatible storage clients for Cloudflare R2.

```typescript
import { createStorageClient } from "@manylead/clients/storage";
import { env } from "@manylead/clients";

// Create storage client (singleton)
const storage = createStorageClient({
  accountId: env.R2_ACCOUNT_ID!,
  accessKeyId: env.R2_ACCESS_KEY_ID!,
  secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
});

// Use with AWS SDK v3
import { PutObjectCommand } from "@aws-sdk/client-s3";

await storage.send(
  new PutObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: "file.txt",
    Body: Buffer.from("Hello World"),
  })
);
```

**Migration Example:**

```typescript
// Before
import { S3Client } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

// After
import { createStorageClient } from "@manylead/clients/storage";
import { env } from "@manylead/clients";

const s3 = createStorageClient({
  accountId: env.R2_ACCOUNT_ID!,
  accessKeyId: env.R2_ACCESS_KEY_ID!,
  secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
});
```

### API Client

Generic API client factory with authentication support.

```typescript
import { createAPIClient } from "@manylead/clients/api";
import { logger } from "./logger";

const api = createAPIClient({
  baseURL: "https://api.example.com",
  apiKey: "your-api-key",
  logger,
});

// Make requests
const data = await api.request<{ users: User[] }>("GET", "/users");
const created = await api.request<User>("POST", "/users", {
  name: "John Doe",
  email: "john@example.com",
});
```

### Evolution API Client

Specialized client for Evolution API with singleton pattern.

```typescript
import {
  createEvolutionAPIClient,
  getEvolutionAPIClient,
} from "@manylead/clients/api";
import { env } from "@manylead/clients";
import { logger } from "./logger";

// Initialize once
createEvolutionAPIClient({
  baseURL: env.EVOLUTION_API_URL!,
  apiKey: env.EVOLUTION_API_KEY!,
  logger,
});

// Get anywhere in the app
const evolutionAPI = getEvolutionAPIClient();
const instances = await evolutionAPI.request("GET", "/instance/fetchInstances");
```

### Logger

Create Pino loggers with component context. Uses JSON logging for compatibility with all environments (Next.js, Worker threads, etc).

```typescript
import { createLogger } from "@manylead/clients/logger";

// Create root logger
const logger = createLogger({
  level: "info",
});

// Create component logger
const apiLogger = createLogger({ component: "api" });

apiLogger.info({ userId: 123 }, "User logged in");
// Output (JSON): {"level":30,"component":"api","userId":123,"msg":"User logged in"}

apiLogger.error({ err: error }, "Request failed");
// Output (JSON): {"level":50,"component":"api","err":{...},"msg":"Request failed"}
```

**Migration Example:**

```typescript
// Before
import pino from "pino";

const logger = pino({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
});

// After
import { createLogger } from "@manylead/clients/logger";

const logger = createLogger(); // Auto-detects environment (debug in dev, info in prod)
```

## Preset Configurations

All factories support presets for common use cases. Presets provide optimized defaults while allowing custom overrides:

```typescript
// Use preset with custom overrides
const redis = createRedisClient({
  url: env.REDIS_URL,
  preset: "queue",
  config: {
    keyPrefix: "myapp:", // Override specific options
  },
});
```

## Graceful Shutdown

All clients provide cleanup functions for graceful shutdown:

```typescript
import { closeRedis } from "@manylead/clients/redis";
import { closePostgres } from "@manylead/clients/postgres";

process.on("SIGTERM", async () => {
  await closeRedis();
  await closePostgres();
  process.exit(0);
});
```

## Benefits

### Before @manylead/clients

- Redis client duplicated 5+ times across packages
- Postgres client duplicated 4+ times across packages
- Queue configs duplicated 3+ times across packages
- Inconsistent error handling (console.error vs structured logging)
- No connection pooling optimization
- Memory leaks from unbounded caches
- Manual event listener setup

### After @manylead/clients

- Single source of truth for all infrastructure clients
- Consistent singleton pattern prevents duplicate connections
- Optimized preset configurations for common use cases
- Structured logging integrated throughout
- Type-safe environment validation
- Automatic event listeners for queues/workers
- Graceful shutdown support

## Architecture

This package follows the singleton factory pattern:

1. **Lazy Initialization**: Clients created on first use
2. **Singleton Cache**: Subsequent calls return existing instance
3. **Preset Configurations**: Best-practice defaults for common scenarios
4. **Override Support**: Custom configs merge with presets
5. **Type Safety**: Full TypeScript support with generics
6. **Structured Logging**: Pino integration with component context

See `docs/ARCHITECTURE_CLIENTS.md` for detailed architecture documentation.

## Migration Guide

For step-by-step migration instructions, see `docs/MIGRATION_CLIENTS_PACKAGE.md`.

## License

Private - ManyLead internal use only
