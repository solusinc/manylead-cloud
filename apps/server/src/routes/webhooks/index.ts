import { Hono } from "hono";

import { evolutionWebhook } from "./evolution";

export const webhooks = new Hono();

/**
 * Evolution API Webhooks
 * POST /webhooks/evolution
 */
webhooks.route("/evolution", evolutionWebhook);
