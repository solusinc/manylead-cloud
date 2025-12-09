import type { PresenceUpdateData } from "../types";

/**
 * Handle presence.update webhook from Evolution API
 * Processes typing and recording indicators from WhatsApp contacts
 *
 * TODO: Temporariamente desabilitado para WhatsApp - apenas cross-org funciona
 */
export function handlePresenceUpdate(
  _instanceName: string,
  _data: PresenceUpdateData,
): void {
  // TEMPORÁRIO: Desabilitar presence do WhatsApp
}
