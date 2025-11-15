import type { SetProxyRequest, SetProxyResponse } from "../types";

export class ProxyMethods {
  constructor(
    private request: <T>(
      method: string,
      path: string,
      body?: unknown,
    ) => Promise<T>,
  ) {}

  /**
   * Configura proxy para a instância
   * https://doc.evolution-api.com/v2/en/endpoints/proxy
   */
  async set(
    instanceName: string,
    params: SetProxyRequest,
  ): Promise<SetProxyResponse> {
    return this.request<SetProxyResponse>(
      "POST",
      `/proxy/set/${instanceName}`,
      params,
    );
  }

  /**
   * Busca configuração de proxy da instância
   */
  async get(instanceName: string): Promise<SetProxyResponse> {
    return this.request<SetProxyResponse>("GET", `/proxy/get/${instanceName}`);
  }
}
