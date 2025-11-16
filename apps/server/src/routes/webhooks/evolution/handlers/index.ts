/**
 * Evolution Webhook Handlers
 *
 * Cada handler é responsável por processar um tipo específico de evento
 */

export { handleQRCodeUpdated } from "./qrcode-updated";
export { handleConnectionUpdate } from "./connection-update";
export { handleMessagesUpsert } from "./messages-upsert";
export { handleMessagesUpdate } from "./messages-update";
export { handleSendMessage } from "./send-message";
