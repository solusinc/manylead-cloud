import type { Logger } from "@manylead/clients/logger";
import { createAPIClient } from "@manylead/clients/api";
import { createLogger } from "@manylead/clients/logger";
import { env } from "./env";
import { HealthMethods } from "./methods/health";
import { InstanceMethods } from "./methods/instance";
import { MessageMethods } from "./methods/message";
import { ProxyMethods } from "./methods/proxy";

export class EvolutionAPIClient {
  private client: ReturnType<typeof createAPIClient>;
  private logger: Logger;

  // Módulos de métodos
  public readonly instance: InstanceMethods;
  public readonly message: MessageMethods;
  public readonly proxy: ProxyMethods;
  public readonly health: HealthMethods;

  constructor(baseURL?: string, apiKey?: string) {
    // Create logger
    this.logger = createLogger({ component: "EvolutionAPI" });

    // Use factory to create HTTP client
    this.client = createAPIClient({
      baseURL: baseURL ?? env.EVOLUTION_API_URL,
      apiKey: apiKey ?? env.EVOLUTION_API_KEY,
      logger: this.logger,
    });

    // Inicializar módulos passando a função request
    const boundRequest = this.request.bind(this);
    this.instance = new InstanceMethods(boundRequest);
    this.message = new MessageMethods(boundRequest);
    this.proxy = new ProxyMethods(boundRequest);
    this.health = new HealthMethods(boundRequest);
  }

  private request<T>(method: string, path: string, body?: unknown): Promise<T> {
    return this.client.request<T>(method, path, body);
  }
}
