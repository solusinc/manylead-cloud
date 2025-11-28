import type { CreateAPIClientOptions } from "./index";
import { createAPIClient } from "./index";

export type CreateEvolutionAPIClientOptions = CreateAPIClientOptions;

type EvolutionAPIClient = ReturnType<typeof createAPIClient>;

// Singleton instance
let evolutionClient: EvolutionAPIClient | null = null;

/**
 * Create Evolution API client singleton
 *
 * Pattern: Singleton factory for Evolution API
 * Based on: packages/evolution-api-client/src/client.ts
 *
 * Note: This provides the base HTTP client. The full EvolutionAPIClient class
 * with methods (instance, message, proxy, health) should remain in
 * @manylead/evolution-api-client and use this factory internally.
 *
 * @example
 * ```typescript
 * import { createEvolutionAPIClient } from "@manylead/clients/api";
 *
 * const client = createEvolutionAPIClient({
 *   baseURL: env.EVOLUTION_API_URL,
 *   apiKey: env.EVOLUTION_API_KEY,
 * });
 * ```
 */
export function createEvolutionAPIClient(
  options: CreateEvolutionAPIClientOptions,
): EvolutionAPIClient {
  if (evolutionClient) {
    return evolutionClient;
  }

  evolutionClient = createAPIClient(options);
  return evolutionClient;
}

/**
 * Get existing Evolution API client (throws if not created)
 *
 * @example
 * ```typescript
 * const client = getEvolutionAPIClient();
 * ```
 */
export function getEvolutionAPIClient(): EvolutionAPIClient {
  if (!evolutionClient) {
    throw new Error(
      "Evolution API client not initialized. Call createEvolutionAPIClient() first.",
    );
  }
  return evolutionClient;
}
