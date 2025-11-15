import { env } from "./env";
import { HealthMethods } from "./methods/health";
import { InstanceMethods } from "./methods/instance";
import { MessageMethods } from "./methods/message";
import { ProxyMethods } from "./methods/proxy";
import type { EvolutionAPIError } from "./types";

export class EvolutionAPIClient {
  private baseURL: string;
  private apiKey: string;

  // Módulos de métodos
  public readonly instance: InstanceMethods;
  public readonly message: MessageMethods;
  public readonly proxy: ProxyMethods;
  public readonly health: HealthMethods;

  constructor(baseURL?: string, apiKey?: string) {
    this.baseURL = baseURL ?? env.EVOLUTION_API_URL;
    this.apiKey = apiKey ?? env.EVOLUTION_API_KEY;

    // Inicializar módulos passando a função request
    const boundRequest = this.request.bind(this);
    this.instance = new InstanceMethods(boundRequest);
    this.message = new MessageMethods(boundRequest);
    this.proxy = new ProxyMethods(boundRequest);
    this.health = new HealthMethods(boundRequest);
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseURL}${path}`;

    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        apikey: this.apiKey,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = (await response.json()) as EvolutionAPIError;
      throw new Error(
        `Evolution API Error: ${error.message || response.statusText}`,
      );
    }

    return response.json() as Promise<T>;
  }
}
