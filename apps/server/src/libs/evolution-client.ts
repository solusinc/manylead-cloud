import { EvolutionAPIClient } from "@manylead/evolution-api-client";

import { env } from "~/env";

// Helper para criar Evolution API Client com env vars do runtime
export function getEvolutionClient() {
  const apiUrl = env.EVOLUTION_API_URL;
  const apiKey = env.EVOLUTION_API_KEY;

  if (!apiUrl || !apiKey) {
    throw new Error(
      "EVOLUTION_API_URL and EVOLUTION_API_KEY must be set in environment variables"
    );
  }

  return new EvolutionAPIClient(apiUrl, apiKey);
}
