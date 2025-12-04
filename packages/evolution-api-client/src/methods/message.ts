import type {
  SendMediaMessageRequest,
  SendMessageResponse,
  SendTextMessageRequest,
  MediaDownloadResponse,
  MarkAsReadRequest,
  MarkAsReadResponse,
} from "../types";

export class MessageMethods {
  constructor(
    private request: <T>(
      method: string,
      path: string,
      body?: unknown,
    ) => Promise<T>,
  ) {}

  /**
   * Envia mensagem de texto
   * https://doc.evolution-api.com/v2/en/endpoints/messages
   */
  async sendText(
    instanceName: string,
    params: SendTextMessageRequest,
  ): Promise<SendMessageResponse> {
    return this.request<SendMessageResponse>(
      "POST",
      `/message/sendText/${instanceName}`,
      params,
    );
  }

  /**
   * Envia mensagem com mídia (imagem, vídeo, áudio, documento)
   * https://doc.evolution-api.com/v2/en/endpoints/messages
   */
  async sendMedia(
    instanceName: string,
    params: SendMediaMessageRequest,
  ): Promise<SendMessageResponse> {
    return this.request<SendMessageResponse>(
      "POST",
      `/message/sendMedia/${instanceName}`,
      params,
    );
  }

  /**
   * Baixa mídia do WhatsApp
   * https://doc.evolution-api.com/v2/en/endpoints/messages
   */
  async downloadMedia(
    instanceName: string,
    messageId: string,
  ): Promise<MediaDownloadResponse> {
    return this.request<MediaDownloadResponse>(
      "GET",
      `/message/download/${instanceName}/${messageId}`,
    );
  }

  /**
   * Marca mensagens como lidas no WhatsApp
   * https://doc.evolution-api.com/v2/api-reference/chat-controller/mark-as-read
   */
  async markAsRead(
    instanceName: string,
    params: MarkAsReadRequest,
  ): Promise<MarkAsReadResponse> {
    return this.request<MarkAsReadResponse>(
      "POST",
      `/chat/markMessageAsRead/${instanceName}`,
      params,
    );
  }
}
