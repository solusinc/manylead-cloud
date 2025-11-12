import { Hono } from "hono";

export const webhooks = new Hono();

/**
 * Webhooks routes (placeholder for Phase 4)
 * Will handle WhatsApp webhook callbacks
 */

// GET /webhooks/whatsapp/:channelId - Webhook verification
// POST /webhooks/whatsapp/:channelId - Webhook callback
