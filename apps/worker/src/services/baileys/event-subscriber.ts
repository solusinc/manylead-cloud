import type Redis from "ioredis";
import { eq, channel } from "@manylead/db";
import QRCode from "qrcode";
import { TenantDatabaseManager } from "@manylead/tenant-db";
import { logger } from "~/libs/utils/logger";

const tenantManager = new TenantDatabaseManager();

type TenantDb = Awaited<ReturnType<typeof tenantManager.getConnection>>;

interface ChannelEvent {
  type: string;
  organizationId: string;
  channelId: string;
  data: QRUpdatedData | ConnectedData | DisconnectedData;
}

interface QRUpdatedData {
  qrCode: string;
  expiresAt: string;
  status: string;
}

interface ConnectedData {
  status: string;
  phoneNumber?: string;
}

interface DisconnectedData {
  status: string;
  error?: string;
}

/**
 * Subscribe to channel events from Redis and update database
 */
export async function subscribeToChannelEvents(redis: Redis): Promise<void> {
  const subscriber = redis.duplicate();

  await subscriber.subscribe("channels:events");

  subscriber.on("message", (channel, message) => {
    if (channel !== "channels:events") return;

    void (async () => {
      try {
        const event = JSON.parse(message) as ChannelEvent;

        logger.info(
          {
            type: event.type,
            channelId: event.channelId,
            organizationId: event.organizationId,
          },
          "[EventSubscriber] Received event"
        );

        await handleChannelEvent(event);
      } catch (error) {
        logger.error(
          { error, message },
          "[EventSubscriber] Failed to process event"
        );
      }
    })();
  });

  logger.info("[EventSubscriber] ✅ Subscribed to channels:events");
}

/**
 * Handle channel events and update database
 */
async function handleChannelEvent(event: ChannelEvent): Promise<void> {
  const { type, organizationId, channelId, data } = event;

  const tenantDb = await tenantManager.getConnection(organizationId);

  switch (type) {
    case "channel:qr-updated":
      await handleQRUpdated(tenantDb, channelId, data as QRUpdatedData);
      break;

    case "channel:connected":
      await handleConnected(tenantDb, channelId, data as ConnectedData);
      break;

    case "channel:disconnected":
      await handleDisconnected(tenantDb, channelId, data as DisconnectedData);
      break;

    default:
      logger.warn(
        { type },
        "[EventSubscriber] Unknown event type, ignoring"
      );
  }
}

/**
 * Handle QR code update - convert to data URL and save to DB
 */
async function handleQRUpdated(
  tenantDb: TenantDb,
  channelId: string,
  data: QRUpdatedData
): Promise<void> {
  try {
    // Convert raw QR string to data URL
    const qrCodeDataURL = await QRCode.toDataURL(data.qrCode);

    await tenantDb
      .update(channel)
      .set({
        qrCode: qrCodeDataURL,
        qrCodeExpiresAt: new Date(data.expiresAt),
        status: data.status,
        updatedAt: new Date(),
      })
      .where(eq(channel.id, channelId));

    logger.info(
      { channelId },
      "[EventSubscriber] ✅ QR code saved to database"
    );
  } catch (error) {
    logger.error(
      { channelId, error },
      "[EventSubscriber] Failed to save QR code"
    );
    throw error;
  }
}

/**
 * Handle successful connection
 */
async function handleConnected(
  tenantDb: TenantDb,
  channelId: string,
  data: ConnectedData
): Promise<void> {
  try {
    await tenantDb
      .update(channel)
      .set({
        status: data.status,
        phoneNumber: data.phoneNumber ?? undefined,
        lastConnectedAt: new Date(),
        verifiedAt: new Date(),
        qrCode: null, // Clear QR code after connection
        qrCodeExpiresAt: null,
        errorMessage: null,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(channel.id, channelId));

    logger.info(
      { channelId },
      "[EventSubscriber] ✅ Channel marked as connected"
    );
  } catch (error) {
    logger.error(
      { channelId, error },
      "[EventSubscriber] Failed to mark channel as connected"
    );
    throw error;
  }
}

/**
 * Handle disconnection
 */
async function handleDisconnected(
  tenantDb: TenantDb,
  channelId: string,
  data: DisconnectedData
): Promise<void> {
  try {
    await tenantDb
      .update(channel)
      .set({
        status: data.status,
        isActive: false,
        errorMessage: data.error ?? null,
        updatedAt: new Date(),
      })
      .where(eq(channel.id, channelId));

    logger.info(
      { channelId },
      "[EventSubscriber] ✅ Channel marked as disconnected"
    );
  } catch (error) {
    logger.error(
      { channelId, error },
      "[EventSubscriber] Failed to mark channel as disconnected"
    );
    throw error;
  }
}
