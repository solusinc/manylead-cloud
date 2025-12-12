# @manylead/db

Database schema and migrations for Manylead.

## Setup

### Initial Seed

Run the initial seed to populate the database with essential data:

```bash
pnpm --filter @manylead/db seed:prod
```

This will create:
- Default database host configuration

## Proxy Configuration

### Adding Proxy Zones

To enable proxy functionality, you need to add proxy zones from Bright Data.

#### ISP Proxy (Recommended for WhatsApp)

ISP proxies use a pool of dedicated IPs. Each organization gets one IP from the pool.

**Prerequisites:**
1. Create an ISP zone in Bright Data dashboard: https://brightdata.com/cp/zones
2. Note the zone credentials (customer ID, zone name, password)
3. Add at least 1 IP to the zone

**Add ISP Zone:**

```bash
pnpm --filter @manylead/db add-proxy-zone:prod \
  --name manylead_isp_br \
  --type isp \
  --country br \
  --customer-id hl_b91d78ff \
  --zone manylead_isp_br \
  --port 33335 \
  --password YOUR_PASSWORD \
  --pool-size 1 \
  --default
```

**Parameters:**
- `--name`: Unique zone name in database
- `--type`: `isp` or `residential`
- `--country`: Country code (br, us, ca, ar, cl, mx, co, pe, pt, es, gb, de, fr)
- `--customer-id`: Your Bright Data customer ID (e.g., hl_b91d78ff)
- `--zone`: Zone name from Bright Data
- `--port`: 33335 for ISP, 22225 for Residential
- `--password`: Zone password from Bright Data
- `--pool-size`: Number of IPs in the pool (ISP only, matches IP count in Bright Data)
- `--default`: Mark as default zone for this type+country combination

#### Residential Proxy

Residential proxies rotate IPs automatically. No pool management needed.

```bash
pnpm --filter @manylead/db add-proxy-zone:prod \
  --name manylead_residential_br \
  --type residential \
  --country br \
  --customer-id hl_b91d78ff \
  --zone manylead_residential \
  --port 22225 \
  --password YOUR_PASSWORD \
  --default
```

**Note:** Don't use `--pool-size` for residential proxies.

### Pool Size Management

For ISP proxies, the `pool-size` should match the number of IPs allocated in your Bright Data zone.

**Check current IPs in Bright Data:**
1. Go to https://brightdata.com/cp/zones
2. Select your ISP zone
3. Check the IP count

**Update pool size in database:**

```bash
# Update via SQL
psql $DATABASE_URL_DIRECT -c "UPDATE proxy_zone SET pool_size = 5 WHERE name = 'manylead_isp_br';"
```

**Auto IP Management:**

The system automatically adds IPs when needed:
- When creating a channel, it checks if pool has available IPs
- If pool is full (activeOrgCount >= poolSize), it adds 1 IP via Bright Data API
- Updates pool_size in database automatically

**Environment Variable Required:**

```bash
BRIGHT_DATA_API_TOKEN="your-api-token"
```

Get API token from: https://brightdata.com/cp/setting/users → Add API key → Permission: Admin

### Viewing Configured Zones

```bash
psql $DATABASE_URL_DIRECT -c "SELECT id, name, type, country, zone, host, port, pool_size, is_default, status FROM proxy_zone;"
```

### Removing a Zone

```bash
psql $DATABASE_URL_DIRECT -c "DELETE FROM proxy_zone WHERE name = 'zone_name';"
```

## Organization Proxy Settings

After adding zones, configure organizations to use them:

**Enable ISP Proxy for an Organization:**

```sql
UPDATE organization_settings
SET proxy_settings = jsonb_build_object(
  'enabled', true,
  'proxyType', 'isp',
  'country', 'br'
)
WHERE organization_id = 'YOUR_ORG_ID';
```

**Enable Residential Proxy:**

```sql
UPDATE organization_settings
SET proxy_settings = jsonb_build_object(
  'enabled', true,
  'proxyType', 'residential',
  'country', 'br'
)
WHERE organization_id = 'YOUR_ORG_ID';
```

**Disable Proxy:**

```sql
UPDATE organization_settings
SET proxy_settings = jsonb_build_object('enabled', false)
WHERE organization_id = 'YOUR_ORG_ID';
```

## Troubleshooting

### Proxy not configured when creating channel

1. **Check if zone exists:**
   ```sql
   SELECT * FROM proxy_zone WHERE type = 'isp' AND country = 'br' AND status = 'active';
   ```

2. **Check organization settings:**
   ```sql
   SELECT proxy_settings FROM organization_settings WHERE organization_id = 'YOUR_ORG_ID';
   ```

3. **Verify credentials match:**
   - Zone name in database matches Bright Data
   - Password is correct
   - Customer ID is correct

4. **Check logs:**
   Look for errors in channel creation logs related to `ensureIspIpAvailable` or `buildEvolutionProxyConfig`

### Pool size mismatch

If pool_size in database doesn't match Bright Data:

```bash
# Sync pool size from Bright Data API (requires BRIGHT_DATA_API_TOKEN)
# This will be available as a maintenance script
```

Or manually update:

```sql
UPDATE proxy_zone SET pool_size = ACTUAL_COUNT WHERE name = 'manylead_isp_br';
```
