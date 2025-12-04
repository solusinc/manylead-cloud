import type {
  ConnectInstanceResponse,
  CreateInstanceRequest,
  CreateInstanceResponse,
  DeleteInstanceResponse,
  FetchInstanceResponse,
  LogoutInstanceResponse,
} from "../types";

export class InstanceMethods {
  constructor(
    private request: <T>(
      method: string,
      path: string,
      body?: unknown,
    ) => Promise<T>,
  ) {}

  /**
   * Cria uma nova instância do WhatsApp
   * https://doc.evolution-api.com/v2/en/endpoints/instance
   */
  async create(params: CreateInstanceRequest): Promise<CreateInstanceResponse> {
    return this.request<CreateInstanceResponse>(
      "POST",
      "/instance/create",
      params,
    );
  }

  /**
   * Busca informações de uma instância
   * https://doc.evolution-api.com/v2/en/endpoints/instance
   */
  async fetch(instanceName: string): Promise<FetchInstanceResponse> {
    return this.request<FetchInstanceResponse>(
      "GET",
      `/instance/fetchInstances?instanceName=${instanceName}`,
    );
  }

  /**
   * Conecta à instância e retorna QR Code
   * https://doc.evolution-api.com/v2/en/endpoints/instance
   */
  async connect(instanceName: string): Promise<ConnectInstanceResponse> {
    return this.request<ConnectInstanceResponse>(
      "GET",
      `/instance/connect/${instanceName}`,
    );
  }

  /**
   * Solicita código de emparelhamento (8 dígitos) para conectar via número de telefone
   * https://doc.evolution-api.com/v2/api-reference/instance-controller/instance-connect
   */
  async requestCode(
    instanceName: string,
    phoneNumber: string,
  ): Promise<{ pairingCode: string; code: string; count: number }> {
    return this.request<{ pairingCode: string; code: string; count: number }>(
      "GET",
      `/instance/connect/${instanceName}?number=${phoneNumber}`,
    );
  }

  /**
   * Desconecta e faz logout da instância
   * https://doc.evolution-api.com/v2/en/endpoints/instance
   */
  async logout(instanceName: string): Promise<LogoutInstanceResponse> {
    return this.request<LogoutInstanceResponse>(
      "DELETE",
      `/instance/logout/${instanceName}`,
    );
  }

  /**
   * Deleta a instância permanentemente
   * https://doc.evolution-api.com/v2/en/endpoints/instance
   */
  async delete(instanceName: string): Promise<DeleteInstanceResponse> {
    return this.request<DeleteInstanceResponse>(
      "DELETE",
      `/instance/delete/${instanceName}`,
    );
  }

  /**
   * Busca foto de perfil de um contato no WhatsApp
   * https://doc.evolution-api.com/v2/api-reference/chat-controller/chat-fetch-profile-picture-url
   */
  async fetchProfilePicture(
    instanceName: string,
    phoneNumber: string,
  ): Promise<{ profilePictureUrl: string | null }> {
    try {
      return await this.request<{ profilePictureUrl: string | null }>(
        "POST",
        `/chat/fetchProfilePictureUrl/${instanceName}`,
        { number: phoneNumber },
      );
    } catch {
      // Se não encontrar foto (privacidade), retornar null
      return { profilePictureUrl: null };
    }
  }
}
