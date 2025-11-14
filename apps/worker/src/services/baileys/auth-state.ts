import type {
  AuthenticationCreds,
  SignalDataSet,
  SignalDataTypeMap,
  SignalKeyStore,
} from "@whiskeysockets/baileys";
import { BufferJSON, initAuthCreds } from "@whiskeysockets/baileys";
import { channel, eq } from "@manylead/db";
import { CHANNEL_LIMITS } from "@manylead/shared";
import { TenantDatabaseManager } from "@manylead/tenant-db";

import { logger } from "~/libs/utils/logger";

/**
 * Custom Baileys Auth State using Database (JSONB)
 *
 * Instead of saving auth state to local files, we save it to the database.
 * This allows:
 * - Multiple workers to share the same session
 * - Session persistence across restarts
 * - Automatic backups with the rest of the data
 * - Works in containerized/serverless environments
 */

interface AuthState {
  creds: AuthenticationCreds;
  keys: SignalKeyStore;
}

/**
 * Use database as auth state storage
 */
export async function useDatabaseAuthState(
  channelId: string,
  organizationId: string
): Promise<{
  state: AuthState;
  saveCreds: () => Promise<void>;
}> {
  const tenantManager = new TenantDatabaseManager();
  const tenantDb = await tenantManager.getConnection(organizationId);

  // Load channel from database
  const [channelRecord] = await tenantDb
    .select()
    .from(channel)
    .where(eq(channel.id, channelId))
    .limit(1);

  if (!channelRecord) {
    throw new Error(`Channel ${channelId} not found`);
  }

  // Load or initialize credentials
  let creds: AuthenticationCreds;
  type SignalDataValue = SignalDataTypeMap[keyof SignalDataTypeMap];
  let keysData: Record<string, SignalDataValue> = {};

  if (channelRecord.authState?.creds) {
    // Load existing auth state from database and restore Buffers
    const authStateStr = JSON.stringify(channelRecord.authState);
    const parsedState = JSON.parse(authStateStr, BufferJSON.reviver) as {
      creds?: AuthenticationCreds;
      keys?: Record<string, SignalDataValue>;
    };

    if (parsedState.creds) {
      creds = parsedState.creds;
      keysData = parsedState.keys ?? {};
    } else {
      creds = initAuthCreds();
    }

    logger.info(
      { channelId },
      "[AuthState] Loaded existing auth state from database"
    );
  } else {
    // Initialize new credentials (first time)
    creds = initAuthCreds();

    logger.info(
      { channelId },
      "[AuthState] Initialized new auth credentials"
    );
  }

  /**
   * Batch write mechanism to reduce database writes
   */
  let batchTimeout: NodeJS.Timeout | null = null;
  let hasPendingWrites = false;

  /**
   * Save credentials to database
   */
  const saveCreds = async () => {
    try {
      await tenantDb
        .update(channel)
        .set({
          authState: {
            creds: JSON.parse(JSON.stringify(creds, BufferJSON.replacer)),
            keys: keysData,
          },
          updatedAt: new Date(),
        })
        .where(eq(channel.id, channelId));

      hasPendingWrites = false;

      logger.debug(
        { channelId },
        "[AuthState] ✅ Saved credentials to database"
      );
    } catch (error) {
      logger.error(
        { channelId, error },
        "[AuthState] Failed to save credentials"
      );
      throw error;
    }
  };

  /**
   * Schedule a batch write with debounce
   */
  const scheduleBatchWrite = () => {
    hasPendingWrites = true;

    // Clear existing timeout
    if (batchTimeout) {
      clearTimeout(batchTimeout);
    }

    // Schedule new batch write
    batchTimeout = setTimeout(() => {
      if (hasPendingWrites) {
        void saveCreds();
      }
    }, CHANNEL_LIMITS.AUTH_STATE_BATCH_DELAY_MS);
  };

  /**
   * Force immediate save (for critical updates like creds.update)
   */
  const saveCredsImmediate = async () => {
    if (batchTimeout) {
      clearTimeout(batchTimeout);
      batchTimeout = null;
    }

    await saveCreds();
  };

  // Save initial credentials immediately
  if (!channelRecord.authState?.creds) {
    await saveCreds();
    logger.info(
      { channelId },
      "[AuthState] Initial credentials saved to database"
    );
  }

  /**
   * Keys store (pre-keys, session keys, etc.)
   */
  const keys: SignalKeyStore = {
    /**
     * Get keys from storage
     */
    get: <T extends keyof SignalDataTypeMap>(
      type: T,
      ids: string[],
    ): Promise<Record<string, SignalDataTypeMap[T]>> => {
      const data: Record<string, SignalDataTypeMap[T]> = {};

      for (const id of ids) {
        const key = `${type}-${id}`;
        const value = keysData[key];
        if (value !== undefined) {
          data[id] = value as SignalDataTypeMap[T];
        }
      }

      return Promise.resolve(data);
    },

    /**
     * Set keys in storage (batch write with debounce)
     */
    set: (data: SignalDataSet): Promise<void> => {
      for (const category in data) {
        const categoryData = data[category as keyof SignalDataSet];
        if (categoryData) {
          for (const id in categoryData) {
            const key = `${category}-${id}`;
            const value = categoryData[id];

            if (value === null || value === undefined) {
              // Delete key
              delete keysData[key];
            } else {
              // Set key
              keysData[key] = value;
            }
          }
        }
      }

      // Schedule batch write instead of immediate save
      scheduleBatchWrite();

      return Promise.resolve();
    },
  };

  return {
    state: {
      creds,
      keys,
    },
    saveCreds: saveCredsImmediate, // Use immediate save for creds.update events
  };
}
