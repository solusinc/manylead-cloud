import type { CreateAPIClientOptions } from "./types";

/**
 * Generic API client factory
 *
 * Pattern: Reusable HTTP client with authentication
 * Note: Specific API clients (Evolution, etc.) should extend this base
 *
 * @example
 * ```typescript
 * import { createAPIClient } from "@manylead/clients/api";
 *
 * const client = createAPIClient({
 *   baseURL: "https://api.example.com",
 *   apiKey: "your-api-key",
 * });
 *
 * const data = await client.request("GET", "/endpoint");
 * ```
 */
export function createAPIClient(options: CreateAPIClientOptions) {
  const { baseURL, apiKey, logger } = options;

  return {
    async request<T>(
      method: string,
      path: string,
      body?: unknown,
    ): Promise<T> {
      const url = `${baseURL}${path}`;

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          apikey: apiKey,
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const error = (await response
          .json()
          .catch(() => ({
            message: response.statusText,
          }))) as { message?: string };

        if (logger) {
          logger.error(
            { method, path, status: response.status, error },
            "API request failed",
          );
        }

        throw new Error(`API Error: ${error.message ?? response.statusText}`);
      }

      return response.json() as Promise<T>;
    },
  };
}

export * from "./evolution";
export * from "./types";
