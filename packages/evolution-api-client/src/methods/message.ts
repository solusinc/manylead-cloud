import type {
  SendMediaMessageRequest,
  SendAudioMessageRequest,
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
    // Log para debug
    console.log('[Evolution API] sendMedia request:', {
      instanceName,
      params: JSON.stringify(params, null, 2)
    });

    return this.request<SendMessageResponse>(
      "POST",
      `/message/sendMedia/${instanceName}`,
      params,
    );
  }

  /**
   * Envia mensagem de áudio (voz) via WhatsApp
   * https://doc.evolution-api.com/v2/api-reference/message-controller/send-audio
   */
  async sendAudio(
    instanceName: string,
    params: SendAudioMessageRequest,
  ): Promise<SendMessageResponse> {
    // Log para debug
    console.log('[Evolution API] sendAudio request:', {
      instanceName,
      params: JSON.stringify(params, null, 2)
    });

    return this.request<SendMessageResponse>(
      "POST",
      `/message/sendWhatsAppAudio/${instanceName}`,
      params,
    );
  }

  /**
   * Baixa mídia do WhatsApp (Evolution API v2)
   * https://doc.evolution-api.com/v2/api-reference/chat-controller/get-base64
   *
   * @param instanceName - Nome da instância Evolution API
   * @param messageId - ID da mensagem no WhatsApp
   * @param mediaType - Tipo de mídia (opcional) - usado para condicionar parâmetros
   */
  async downloadMedia(
    instanceName: string,
    messageId: string,
    mediaType?: "image" | "video" | "audio" | "document",
  ): Promise<MediaDownloadResponse> {
    const body: Record<string, unknown> = {
      message: {
        key: {
          id: messageId,
        },
      },
    };

    // Apenas para vídeo, adicionar o parâmetro convertToMp4: false (manter formato original)
    // Para áudio, omitir completamente esse parâmetro (Evolution API retorna 400 Bad Request quando recebe convertToMp4 para áudio)
    // Para imagem/documento, também omitir (não aplicável)
    if (mediaType === "video") {
      body.convertToMp4 = false; // false = manter formato original (não converter para MP4)
    }

    // Log para debug: mostrar exatamente o que está sendo enviado
    console.log('[Evolution API] downloadMedia request:', {
      instanceName,
      messageId,
      mediaType,
      body: JSON.stringify(body, null, 2)
    });

    return this.request<MediaDownloadResponse>(
      "POST",
      `/chat/getBase64FromMediaMessage/${instanceName}`,
      body,
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
