import { EvolutionAPIClient } from "./client";

export { EvolutionAPIClient };
export type * from "./types";

/**
 * Singleton instance of Evolution API Client
 *
 * @example
 * ```typescript
 * import { evolutionAPI } from "@manylead/evolution-api-client";
 *
 * const instances = await evolutionAPI.instance.fetchInstances();
 * ```
 */
export const evolutionAPI = new EvolutionAPIClient();
