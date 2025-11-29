# 🧪 Testing Attachment Cleanup Workers

## 🚀 Quick Start

### Enable Test Mode (30s intervals)

```bash
# Set env var
export ENABLE_TEST_CRON=true

# Restart worker
pnpm --filter @manylead/worker dev
```

**Logs esperados:**
```
⚠️  TEST MODE ENABLED - Cron jobs running every 30 seconds with dry-run
Cron job configured: attachment-cleanup (every 30s (TEST MODE))
Cron job configured: attachment-orphan-cleanup (every 30s (TEST MODE - DRY RUN))
```

---

## 📋 Test Scenarios

### Test 1: Orphan File in R2 (no DB record)

**Setup:**
1. Upload file manually to R2:
   ```bash
   # Via R2 dashboard or AWS CLI
   aws s3 cp test.jpg s3://your-bucket/media/ORG_ID/orphan-test.jpg --endpoint-url https://ACCOUNT_ID.r2.cloudflarestorage.com
   ```

2. Wait 30s (or trigger manually)

**Expected Result:**
```
[DRY RUN] Would delete orphaned R2 files
Found orphaned R2 file (no DB record): media/ORG_ID/orphan-test.jpg
```

---

### Test 2: Orphan DB Record (file deleted from R2)

**Setup:**
1. Create attachment in DB via upload
2. Manually delete file from R2:
   ```bash
   aws s3 rm s3://your-bucket/media/ORG_ID/some-file.jpg --endpoint-url https://...
   ```

3. Wait 30s

**Expected Result:**
```
Found orphaned DB record (file missing in R2)
[DRY RUN] Would mark DB records as expired
```

---

### Test 3: Trigger Manual Cleanup (via TRPC)

**Frontend/API:**
```typescript
// Dry-run (logs only, no deletion)
await trpc.attachments.triggerOrphanCleanup.mutate({ dryRun: true });

// Real cleanup
await trpc.attachments.triggerOrphanCleanup.mutate({ dryRun: false });
```

**Expected:**
- Job enqueued immediately
- Worker processes job
- Logs show orphans found/deleted

---

### Test 4: Normal Lifecycle Cleanup

**Setup:**
1. Upload media (image/video)
2. Wait for R2 lifecycle to delete (2 days for video, 90 days for images)
3. Cleanup worker marks as expired

**Expected:**
```
Marked expired videos: 5
Marked expired media: 12
```

---

## 🔍 Monitoring Tests

### Check BullMQ Dashboard (Bull Board)

```bash
# Add to dev dependencies
pnpm add -D @bull-board/express

# Access: http://localhost:3000/admin/queues
```

### Check Redis

```bash
redis-cli
> KEYS bull:attachment-orphan-cleanup:*
> HGETALL bull:attachment-orphan-cleanup:repeat:attachment-orphan-cleanup-weekly
```

### Check Logs

```bash
# Worker logs
pnpm --filter @manylead/worker dev

# Look for:
# - "Job completed"
# - "Found orphaned..."
# - "Deleted orphaned..."
```

---

## 🛠️ Manual Testing Commands

### 1. List R2 Files

```bash
aws s3 ls s3://your-bucket/media/ORG_ID/ --recursive --endpoint-url https://...
```

### 2. Query DB Attachments

```sql
SELECT id, file_name, storage_path, download_status
FROM attachment
WHERE download_status = 'completed';
```

### 3. Trigger Job Manually (Node)

```typescript
import { createQueue } from "@manylead/clients/queue";
import { getRedisClient } from "@manylead/clients/redis";

const connection = getRedisClient(process.env.REDIS_URL);
const queue = createQueue({
  name: "attachment-orphan-cleanup",
  connection,
});

await queue.add("manual-test", {
  organizationId: "YOUR_ORG_ID",
  dryRun: true,
});
```

---

## ⚙️ Disable Test Mode (Production)

```bash
# Unset env var
unset ENABLE_TEST_CRON

# Or set NODE_ENV to production
export NODE_ENV=production

# Restart worker
pnpm --filter @manylead/worker dev
```

**Production Schedule:**
- `attachment-cleanup`: Daily at 3am
- `attachment-orphan-cleanup`: Sundays at 4am

---

## 🐛 Troubleshooting

### Jobs not running?

1. Check Redis connection
2. Check worker logs for errors
3. Verify cron pattern: `*/30 * * * * *` (every 30s)
4. Check BullMQ repeatable jobs: `queue.getRepeatableJobs()`

### Orphans not detected?

1. Verify `organizationId` in job data
2. Check R2 bucket permissions
3. Verify storage path format: `media/{orgId}/{file}`
4. Check logs for "list()" errors

### Files not deleting?

1. Check `dryRun` flag (should be `false` in prod)
2. Verify R2 credentials
3. Check storage provider `delete()` method
4. Look for errors in worker logs
