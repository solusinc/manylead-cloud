import ffmpeg from "fluent-ffmpeg";
import { Readable, PassThrough } from "node:stream";
import { storage } from "@manylead/storage";
import { generateMediaPath } from "@manylead/storage/utils";

/**
 * Audio Converter Service
 *
 * Responsabilidades:
 * - Converter áudio de qualquer formato para OGG/Opus otimizado para WhatsApp
 * - Baixar áudio do R2, converter, e fazer upload do convertido
 * - Remover metadados que WhatsApp rejeita
 */
export class AudioConverterService {
  /**
   * Converte áudio para formato WhatsApp (OGG/Opus)
   *
   * @param organizationId - ID da organização (para path no R2)
   * @param sourceUrl - URL do áudio original no R2
   * @param sourceStoragePath - Storage path do áudio original
   * @param sourceMimeType - MIME type do áudio original (para detectar formato)
   * @returns URL e storage path do áudio convertido
   */
  async convertToWhatsAppFormat(
    organizationId: string,
    sourceUrl: string,
    sourceStoragePath: string,
    sourceMimeType: string,
  ): Promise<{
    convertedUrl: string;
    convertedStoragePath: string;
    convertedMimeType: string;
    convertedFileName: string;
  }> {
    // 1. Detectar formato de entrada a partir do mimeType
    const inputFormat = this.detectInputFormat(sourceMimeType);

    // 2. Baixar áudio original do R2
    const audioBuffer = await storage.download(sourceStoragePath);

    // 3. Converter usando ffmpeg
    const convertedBuffer = await this.convertAudio(audioBuffer, inputFormat);

    // 4. Gerar novo nome de arquivo e path
    const convertedFileName = `audio-${Date.now()}.ogg`;
    const convertedStoragePath = generateMediaPath(
      organizationId,
      convertedFileName,
      "audio/ogg",
    );

    // 5. Upload do áudio convertido para R2
    const uploadResult = await storage.upload({
      key: convertedStoragePath,
      body: convertedBuffer,
      contentType: "audio/ogg; codecs=opus",
      metadata: {
        organizationId,
        originalMimeType: sourceMimeType,
        originalPath: sourceStoragePath,
        converted: "true",
      },
    });

    return {
      convertedUrl: uploadResult.url,
      convertedStoragePath: uploadResult.key,
      convertedMimeType: "audio/ogg",
      convertedFileName,
    };
  }

  /**
   * Detecta formato de entrada a partir do mimeType
   */
  private detectInputFormat(mimeType: string): string {
    // Remover parâmetros de codec (e.g., "audio/webm;codecs=opus" -> "audio/webm")
    const baseType = mimeType.split(";")[0]?.trim().toLowerCase();

    const formatMap: Record<string, string> = {
      "audio/webm": "webm",
      "audio/ogg": "ogg",
      "audio/mpeg": "mp3",
      "audio/mp3": "mp3",
      "audio/mp4": "mp4",
      "audio/aac": "aac",
      "audio/wav": "wav",
      "audio/x-wav": "wav",
    };

    return formatMap[baseType ?? "audio/webm"] ?? "webm"; // Default webm
  }

  /**
   * Converte áudio usando ffmpeg
   *
   * Configuração otimizada para WhatsApp:
   * - Codec: libopus (melhor compressão para voz)
   * - Mono: 1 canal (voz não precisa de stereo)
   * - Sample rate: 16 kHz (suficiente para voz)
   * - Bitrate: 24k (boa qualidade, arquivo pequeno)
   * - Remove metadados (WhatsApp rejeita alguns metadados)
   */
  private async convertAudio(
    inputBuffer: Buffer,
    inputFormat: string,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];

      // Criar stream de input a partir do buffer
      const inputStream = new Readable();
      inputStream.push(inputBuffer);
      inputStream.push(null);

      // Stream de output
      const outputStream = new PassThrough();

      outputStream.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      });

      outputStream.on("end", () => {
        resolve(Buffer.concat(chunks));
      });

      outputStream.on("error", (error) => {
        reject(error);
      });

      // Configurar ffmpeg
      ffmpeg(inputStream)
        .inputFormat(inputFormat)
        .audioCodec("libopus") // codec opus
        .audioChannels(1) // mono
        .audioFrequency(16000) // Sample rate 16 kHz
        .audioBitrate("24k") // bitrate 24k
        .addOutputOptions([
          "-map_metadata -1", // remove metadata
          "-metadata:s:a vendor=Recorder", // add metadata vendor = Recorder
          "-metadata encoder=", // remove metadata encoder
          "-application voip", // application voip
          "-vbr off", // vbr off
          "-vn", // remove video stream
          "-avoid_negative_ts make_zero", // avoid negative timestamps
        ])
        .toFormat("ogg")
        .on("error", (error) => {
          reject(new Error(`Erro ao converter áudio: ${error.message}`));
        })
        .pipe(outputStream, { end: true });
    });
  }
}
