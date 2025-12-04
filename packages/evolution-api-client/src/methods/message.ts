import type {
  SendMediaMessageRequest,
  SendMessageResponse,
  SendTextMessageRequest,
  MediaDownloadResponse,
  MarkAsReadRequest,
  MarkAsReadResponse,
  UpdateMessageRequest,
  UpdateMessageResponse,
  DeleteMessageRequest,
  DeleteMessageResponse,
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
   * Baixa mídia do WhatsApp (Evolution API v2)
   * https://doc.evolution-api.com/v2/api-reference/chat-controller/get-base64
   */
  async downloadMedia(
    instanceName: string,
    messageId: string,
  ): Promise<MediaDownloadResponse> {
    return this.request<MediaDownloadResponse>(
      "POST",
      `/chat/getBase64FromMediaMessage/${instanceName}`,
      {
        message: {
          key: {
            id: messageId,
          },
        },
        convertToMp4: false, // Manter formato original
      },
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

  /**
   * Edita uma mensagem existente no WhatsApp
   * https://doc.evolution-api.com/v2/api-reference/chat-controller/update-message
   */
  async updateMessage(
    instanceName: string,
    params: UpdateMessageRequest,
  ): Promise<UpdateMessageResponse> {
    return this.request<UpdateMessageResponse>(
      "POST",
      `/chat/updateMessage/${instanceName}`,
      params,
    );
  }

  /**
   * Deleta uma mensagem para todos no WhatsApp
   * https://doc.evolution-api.com/v2/api-reference/chat-controller/delete-message-for-everyone
   */
  async deleteMessage(
    instanceName: string,
    params: DeleteMessageRequest,
  ): Promise<DeleteMessageResponse> {
    return this.request<DeleteMessageResponse>(
      "DELETE",
      `/chat/deleteMessageForEveryone/${instanceName}`,
      params,
    );
  }
}
