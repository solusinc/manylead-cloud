import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import type { QuickReplyMessage } from "@manylead/db/schema";

import { useTRPC } from "~/lib/trpc/react";

interface UploadProgress {
  total: number;
  completed: number;
  failed: number;
  current?: string; // Nome do arquivo sendo uploadado
}

export function useUploadQuickReplyMedia() {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress>({
    total: 0,
    completed: 0,
    failed: 0,
  });

  const trpc = useTRPC();
  const getSignedUrlMutation = useMutation(
    trpc.attachments.getSignedUploadUrl.mutationOptions(),
  );

  /**
   * Faz upload de uma mensagem com mídia para o R2
   */
  const uploadMessage = useCallback(
    async (message: QuickReplyMessage): Promise<QuickReplyMessage> => {
      // Se não tem mídia ou já tem URL do R2, retorna como está
      if (!message.mediaUrl || message.mediaUrl.startsWith("http")) {
        return message;
      }

      // Se tem base64, fazer upload
      if (message.mediaUrl.startsWith("data:")) {
        const blob = await fetch(message.mediaUrl).then((res) => res.blob());
        const file = new File(
          [blob],
          message.mediaName ?? "file",
          { type: message.mediaMimeType ?? "application/octet-stream" }
        );

        // 1. Obter signed URL
        const signedData = await getSignedUrlMutation.mutateAsync({
          fileName: file.name,
          mimeType: file.type,
          expiresIn: 300,
        });

        // 2. Upload para R2
        const xhr = new XMLHttpRequest();
        await new Promise<void>((resolve, reject) => {
          xhr.open("PUT", signedData.uploadUrl);
          xhr.setRequestHeader("Content-Type", file.type);
          xhr.onload = () =>
            xhr.status === 200
              ? resolve()
              : reject(new Error(`Upload failed with status ${xhr.status}`));
          xhr.onerror = () => reject(new Error("Upload failed"));
          xhr.send(file);
        });

        // 3. Retornar mensagem com URL do R2
        return {
          ...message,
          mediaUrl: signedData.publicUrl,
        };
      }

      return message;
    },
    [getSignedUrlMutation]
  );

  /**
   * Faz upload de todas as mensagens com mídia
   */
  const uploadMessages = useCallback(
    async (messages: QuickReplyMessage[]): Promise<QuickReplyMessage[]> => {
      const messagesToUpload = messages.filter(
        (msg) =>
          msg.mediaUrl &&
          msg.mediaUrl.startsWith("data:") &&
          !msg.mediaUrl.startsWith("http")
      );

      if (messagesToUpload.length === 0) {
        return messages;
      }

      // Garantir que o UI atualize antes de começar o upload
      setIsUploading(true);
      setProgress({
        total: messagesToUpload.length,
        completed: 0,
        failed: 0,
      });

      // Pequeno delay para garantir que o UI renderize o estado de upload
      await new Promise((resolve) => setTimeout(resolve, 100));

      const uploadedMessages = [...messages];
      const errors: string[] = [];

      for (let i = 0; i < messages.length; i++) {
        const message = messages[i];
        if (!message) continue;

        // Só fazer upload se tiver base64
        if (message.mediaUrl?.startsWith("data:")) {
          try {
            setProgress((prev) => ({
              ...prev,
              current: message.mediaName ?? undefined,
            }));

            const uploaded = await uploadMessage(message);
            uploadedMessages[i] = uploaded;

            setProgress((prev) => ({
              ...prev,
              completed: prev.completed + 1,
            }));

            // Pequeno delay entre uploads para o UI atualizar
            await new Promise((resolve) => setTimeout(resolve, 50));
          } catch (error) {
            console.error("Erro ao fazer upload:", error);
            errors.push(message.mediaName ?? "Arquivo desconhecido");

            setProgress((prev) => ({
              ...prev,
              failed: prev.failed + 1,
            }));
          }
        }
      }

      setIsUploading(false);

      // Se teve erros, lançar exceção para o form tratar
      if (errors.length > 0) {
        throw new Error(
          `Erro ao fazer upload de ${errors.length} arquivo(s): ${errors.join(", ")}`
        );
      }

      return uploadedMessages;
    },
    [uploadMessage]
  );

  return {
    uploadMessages,
    isUploading,
    progress,
  };
}
