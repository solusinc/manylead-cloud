/**
 * Extrator de conteúdo de mensagens WhatsApp
 *
 * Responsabilidades:
 * - Extrair texto e mídia de diferentes tipos de mensagem
 * - Mapear tipos da Evolution API para nosso enum
 */
export class MessageContentExtractor {
  /**
   * Extrai conteúdo de texto e mídia da mensagem
   */
  extract(messageObj: Record<string, unknown> | undefined): MessageContent {
    if (!messageObj) {
      return { text: "", hasMedia: false };
    }

    // Mensagem de texto simples
    if (messageObj.conversation) {
      return this.extractText(messageObj);
    }

    // Mensagem estendida (com preview de link)
    if (messageObj.extendedTextMessage) {
      return this.extractExtendedText(messageObj);
    }

    // Imagem
    if (messageObj.imageMessage) {
      return this.extractImage(messageObj);
    }

    // Vídeo
    if (messageObj.videoMessage) {
      return this.extractVideo(messageObj);
    }

    // Áudio
    if (messageObj.audioMessage) {
      return this.extractAudio(messageObj);
    }

    // Documento
    if (messageObj.documentMessage) {
      return this.extractDocument(messageObj);
    }

    return { text: "[Mensagem não suportada]", hasMedia: false };
  }

  /**
   * Mapeia messageType do Evolution API para nosso enum
   */
  mapType(evType: string | undefined): MessageType {
    if (!evType) return "text";

    const lower = evType.toLowerCase();

    if (lower.includes("image")) return "image";
    if (lower.includes("video")) return "video";
    if (lower.includes("audio")) return "audio";
    if (lower.includes("document")) return "document";

    return "text";
  }

  // Private extraction methods

  private extractText(messageObj: Record<string, unknown>): MessageContent {
    return {
      text: typeof messageObj.conversation === "string" ? messageObj.conversation : "",
      hasMedia: false,
    };
  }

  private extractExtendedText(messageObj: Record<string, unknown>): MessageContent {
    const ext = messageObj.extendedTextMessage as Record<string, unknown>;
    return {
      text: typeof ext.text === "string" ? ext.text : "",
      hasMedia: false,
    };
  }

  private extractImage(messageObj: Record<string, unknown>): MessageContent {
    const img = messageObj.imageMessage as Record<string, unknown>;
    const caption = typeof img.caption === "string" ? img.caption : "";
    return {
      text: caption, // Usa caption se presente, vazio caso contrário
      hasMedia: true,
      mediaUrl: typeof img.url === "string" ? img.url : "",
      mimeType: typeof img.mimetype === "string" ? img.mimetype : "image/jpeg",
      fileName: typeof img.fileName === "string" ? img.fileName : "image.jpg",
      caption,
    };
  }

  private extractVideo(messageObj: Record<string, unknown>): MessageContent {
    const vid = messageObj.videoMessage as Record<string, unknown>;
    const caption = typeof vid.caption === "string" ? vid.caption : "";
    return {
      text: caption, // Usa caption se presente, vazio caso contrário
      hasMedia: true,
      mediaUrl: typeof vid.url === "string" ? vid.url : "",
      mimeType: typeof vid.mimetype === "string" ? vid.mimetype : "video/mp4",
      fileName: typeof vid.fileName === "string" ? vid.fileName : "video.mp4",
      caption,
    };
  }

  private extractAudio(messageObj: Record<string, unknown>): MessageContent {
    const aud = messageObj.audioMessage as Record<string, unknown>;
    return {
      text: "", // Áudio não precisa de texto placeholder
      hasMedia: true,
      mediaUrl: typeof aud.url === "string" ? aud.url : "",
      mimeType: typeof aud.mimetype === "string" ? aud.mimetype : "audio/ogg",
      fileName: typeof aud.fileName === "string" ? aud.fileName : "audio.ogg",
    };
  }

  private extractDocument(messageObj: Record<string, unknown>): MessageContent {
    const doc = messageObj.documentMessage as Record<string, unknown>;
    const caption = typeof doc.caption === "string" ? doc.caption : "";
    const fileName = typeof doc.fileName === "string" ? doc.fileName : "document.pdf";
    return {
      text: caption || fileName || "[Documento]",
      hasMedia: true,
      mediaUrl: typeof doc.url === "string" ? doc.url : "",
      mimeType: typeof doc.mimetype === "string" ? doc.mimetype : "application/pdf",
      fileName,
      caption,
    };
  }
}

export type MessageType = "text" | "image" | "video" | "audio" | "document";

export interface MessageContent {
  text: string;
  hasMedia: boolean;
  mediaUrl?: string;
  mimeType?: string;
  fileName?: string;
  caption?: string;
}
