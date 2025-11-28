import { evolutionAPI } from "@manylead/evolution-api-client";

/**
 * Evolution API Client singleton
 *
 * @deprecated Use `evolutionAPI` directly from @manylead/evolution-api-client
 */
export function getEvolutionClient() {
  return evolutionAPI;
}
