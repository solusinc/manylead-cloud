import { Hono } from "hono";

import { evolutionWebhook } from "./evolution";
import { metaWebhook } from "./meta";

export const webhooks = new Hono();

/**
 * Evolution API Webhooks
 * POST /webhooks/evolution
 */
webhooks.route("/evolution", evolutionWebhook);

/**
 * Meta (WhatsApp Business API) Webhooks
 * GET /webhooks/meta - Verification
 * POST /webhooks/meta - Events
 */
webhooks.route("/meta", metaWebhook);
