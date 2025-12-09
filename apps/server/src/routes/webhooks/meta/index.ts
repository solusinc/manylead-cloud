import crypto from "node:crypto";
import type { Context } from "hono";
import { Hono } from "hono";

import { env } from "~/env";
import { createLogger } from "~/libs/utils/logger";

const log = createLogger("MetaWebhook");

export const metaWebhook = new Hono();

/**
 * Validate Meta webhook signature (X-Hub-Signature-256)
 */
function validateSignature(payload: string, signature: string | undefined): boolean {
  if (!env.META_APP_SECRET || !signature) {
    // Skip validation if no app secret configured
    return true;
  }

  const expectedSignature = `sha256=${crypto
    .createHmac("sha256", env.META_APP_SECRET)
    .update(payload)
    .digest("hex")}`;

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature),
  );
}

/**
 * GET /webhooks/meta
 *
 * Webhook verification endpoint for Meta (WhatsApp Business API)
 * Meta sends a GET request to verify the webhook URL
 */
metaWebhook.get("/", (c: Context) => {
  const mode = c.req.query("hub.mode");
  const token = c.req.query("hub.verify_token");
  const challenge = c.req.query("hub.challenge");

  log.info({ mode, token, challenge }, "Meta webhook verification request");

  // Validate token and return challenge
  if (mode === "subscribe" && token === env.META_WEBHOOK_VERIFY_TOKEN && challenge) {
    log.info("Webhook verified successfully");
    return c.text(challenge, 200);
  }

  log.warn({ mode, token }, "Webhook verification failed");
  return c.text("Forbidden", 403);
});

/**
 * POST /webhooks/meta
 *
 * Endpoint que recebe webhooks da Meta (WhatsApp Business API)
 */
metaWebhook.post("/", async (c: Context) => {
  try {
    // Get raw body for signature validation
    const rawBody = await c.req.text();
    const signature = c.req.header("x-hub-signature-256");

    // Validate signature
    if (!validateSignature(rawBody, signature)) {
      log.warn("Invalid webhook signature");
      return c.text("Invalid signature", 401);
    }

    const payload: unknown = JSON.parse(rawBody);

    log.info({ payload }, "Meta webhook received");

    // TODO: Process webhook payload
    // For now, just return 200 to acknowledge receipt

    return c.text("EVENT_RECEIVED", 200);
  } catch (error) {
    log.error({ err: error }, "Error processing Meta webhook");

    // Return 200 to prevent retries
    return c.text("EVENT_RECEIVED", 200);
  }
});
