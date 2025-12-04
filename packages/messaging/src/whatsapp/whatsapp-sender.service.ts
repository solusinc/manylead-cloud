import type {
  EvolutionAPIClient,
  SendMessageResponse,
  SendTextMessageRequest,
  SendMediaMessageRequest,
} from "@manylead/evolution-api-client";
import type {
  WhatsAppSendTextParams,
  WhatsAppSendMediaParams,
  // WhatsAppMarkAsReadParams,
} from "./whatsapp-message.types";

/**
 * WhatsApp Sender Service
 *
 * Camada de abstração para comunicação com Evolution API.
 *
 * Responsabilidades:
 * - Encapsular TODAS as chamadas à Evolution API
 * - Fornecer interface limpa e type-safe
 * - Tratar erros de comunicação
 *
 * Princípios SOLID:
 * - Single Responsibility: Apenas comunicação com Evolution API
 * - Dependency Inversion: Recebe EvolutionAPIClient via constructor
 */
export class WhatsAppSenderService {
  constructor(private evolutionClient: EvolutionAPIClient) {}

  /**
   * Enviar mensagem de texto
   *
   * @param params - Parâmetros de envio
   * @returns Response da Evolution API com whatsappMessageId
   */
  async sendText(
    params: WhatsAppSendTextParams,
  ): Promise<SendMessageResponse> {
    const request: SendTextMessageRequest = {
      number: params.phoneNumber,
      text: params.text,
      quoted: params.quoted,
    };

    return await this.evolutionClient.message.sendText(
      params.instanceName,
      request,
    );
  }

  /**
   * Enviar mensagem com mídia (imagem, vídeo, áudio, documento)
   *
   * @param params - Parâmetros de envio de mídia
   * @returns Response da Evolution API com whatsappMessageId
   */
  async sendMedia(
    params: WhatsAppSendMediaParams,
  ): Promise<SendMessageResponse> {
    const request: SendMediaMessageRequest = {
      number: params.phoneNumber,
      media: params.mediaUrl,
      mediatype: params.mediaType,
      fileName: params.filename,
      caption: params.caption,
    };

    return await this.evolutionClient.message.sendMedia(
      params.instanceName,
      request,
    );
  }

  /**
   * Enviar mensagem de texto com citação (reply)
   *
   * Atalho para sendText() com quoted configurado
   *
   * @param params - Parâmetros de envio
   * @param quotedMessageId - ID da mensagem WhatsApp a ser citada
   * @param quotedRemoteJid - remoteJid da mensagem citada
   * @param quotedFromMe - Se a mensagem citada foi enviada pelo agente
   * @returns Response da Evolution API
   */
  async sendWithQuoted(
    params: Omit<WhatsAppSendTextParams, "quoted">,
    quotedMessageId: string,
    quotedRemoteJid: string,
    quotedFromMe: boolean,
  ): Promise<SendMessageResponse> {
    return await this.sendText({
      ...params,
      quoted: {
        key: {
          remoteJid: quotedRemoteJid,
          fromMe: quotedFromMe,
          id: quotedMessageId,
        },
      },
    });
  }

  // /**
  //  * Marcar mensagem como lida no WhatsApp
  //  *
  //  * TODO: Implementar quando Evolution API suportar mark as read
  //  * Documentação: https://doc.evolution-api.com/v2/en/endpoints/messages
  //  *
  //  * @param params - Parâmetros para marcar como lido
  //  */
  // async markAsRead(params: WhatsAppMarkAsReadParams): Promise<void> {
  //   // TODO: Implementar quando Evolution API Client tiver método markAsRead
  //   // await this.evolutionClient.message.markAsRead(params.instanceName, {
  //   //   remoteJid: params.remoteJid,
  //   //   messageId: params.messageId,
  //   // });
  //   throw new Error("markAsRead not implemented yet in Evolution API Client");
  // }

  /**
   * Buscar foto de perfil do contato
   *
   * @param instanceName - Nome da instância Evolution API
   * @param phoneNumber - Número do telefone do contato
   * @returns URL da foto ou null se privada/não encontrada
   */
  async fetchProfilePicture(
    instanceName: string,
    phoneNumber: string,
  ): Promise<string | null> {
    try {
      const result =
        await this.evolutionClient.instance.fetchProfilePicture(
          instanceName,
          phoneNumber,
        );
      return result.profilePictureUrl;
    } catch {
      // Foto pode ser privada ou não existir
      return null;
    }
  }
}
