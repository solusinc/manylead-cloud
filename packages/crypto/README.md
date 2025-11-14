# @manylead/crypto

Cryptography utilities for encrypting sensitive data (Baileys authState, BYOC access tokens).

## Features

- **AES-256-GCM encryption** (AEAD - Authenticated Encryption with Associated Data)
- **Type-safe** with TypeScript
- **Environment-based key management** via `@t3-oss/env-core`
- **Secure by default** (random IV per encryption, auth tags for integrity)

## Installation

```bash
pnpm add @manylead/crypto
```

## Environment Setup

Add to your `.env`:

```bash
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=your_64_character_hex_string_here
```

**Important:** The key MUST be exactly 64 hex characters (32 bytes).

Generate a secure key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Usage

### Encrypt Data

```typescript
import { encrypt } from "@manylead/crypto";

// Encrypt any JSON-serializable data
const baileysAuth = {
  creds: { /* ... */ },
  keys: { /* ... */ },
};

const encrypted = encrypt(baileysAuth);

// Store in database
await db.update(channel).set({
  authState: encrypted.encrypted,
  authStateIv: encrypted.iv,
  authStateTag: encrypted.tag,
});
```

### Decrypt Data

```typescript
import { decrypt } from "@manylead/crypto";

// Read from database
const channel = await db.query.channels.findFirst({ /* ... */ });

// Decrypt
const authState = decrypt({
  encrypted: channel.authState,
  iv: channel.authStateIv,
  tag: channel.authStateTag,
});

console.log(authState); // { creds: {...}, keys: {...} }
```

### Check if Encrypted

```typescript
import { isEncrypted } from "@manylead/crypto";

const maybeEncrypted = "a1b2c3d4...";

if (isEncrypted(maybeEncrypted)) {
  const decrypted = decrypt({ encrypted: maybeEncrypted, iv, tag });
}
```

## Database Schema Example

```typescript
// BYOC Access Token
export const channel = pgTable("channel", {
  id: uuid("id").primaryKey(),

  // Encrypted fields (3 columns per encrypted value)
  accessToken: text("access_token"),         // Encrypted data
  accessTokenIv: varchar("access_token_iv", { length: 32 }),  // IV
  accessTokenTag: varchar("access_token_tag", { length: 32 }), // Auth tag
});
```

## Security Notes

1. **Never commit** `ENCRYPTION_KEY` to git
2. **Rotate keys** if compromised (requires re-encrypting all data)
3. **Use different keys** for dev/staging/production
4. **Backup keys** securely (losing key = losing all encrypted data)

## How It Works

### AES-256-GCM

- **AES-256**: Advanced Encryption Standard with 256-bit key
- **GCM**: Galois/Counter Mode (provides both encryption + authentication)
- **IV**: Initialization Vector (random, unique per encryption)
- **Auth Tag**: Ensures data hasn't been tampered with

### Why 3 fields?

- `encrypted`: The actual encrypted data
- `iv`: Initialization Vector (needed for decryption)
- `tag`: Authentication tag (ensures integrity)

All three are required to decrypt data successfully.

## Migration from Plain Text

If you have existing plain text data:

```typescript
// Check and encrypt if needed
if (!channel.authStateIv) {
  // Data is plain text, encrypt it
  const encrypted = encrypt(JSON.parse(channel.authState));

  await db.update(channel).set({
    authState: encrypted.encrypted,
    authStateIv: encrypted.iv,
    authStateTag: encrypted.tag,
  });
}
```

## Performance

- Encryption: ~0.1ms for small objects (<10KB)
- Decryption: ~0.1ms for small objects (<10KB)
- Negligible overhead for auth state and access tokens

## License

Private - @manylead
