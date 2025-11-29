import { useState, useCallback } from "react";
import { v7 as uuidv7 } from "uuid";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/lib/trpc/react";
import { useMessageDeduplication } from "~/hooks/use-message-deduplication";
import { useNotificationSound } from "~/hooks/use-notification-sound";

export function useSendMedia(_chatId: string) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const { register } = useMessageDeduplication();
  const { playNotificationSound } = useNotificationSound();

  const getSignedUrlMutation = useMutation(trpc.attachments.getSignedUploadUrl.mutationOptions());
  const sendWithAttachmentMutation = useMutation(trpc.messages.sendWithAttachment.mutationOptions());

  const sendMedia = useCallback(async (options: {
    chatId: string;
    file: File;
    caption?: string;
    metadata?: Record<string, unknown>;
  }) => {
    const tempId = uuidv7();

    try {
      setIsUploading(true);
      setUploadProgress(0);

      // 1. Extrair dimensões
      const dimensions = await extractDimensions(options.file);

      // 2. Obter signed URL
      const signedData = await getSignedUrlMutation.mutateAsync({
        fileName: options.file.name,
        mimeType: options.file.type,
        expiresIn: 300,
      });

      setUploadProgress(10);

      // 3. Upload para R2
      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 80) + 10; // 10-90%
          setUploadProgress(progress);
        }
      };

      await new Promise((resolve, reject) => {
        xhr.open("PUT", signedData.uploadUrl);
        xhr.setRequestHeader("Content-Type", options.file.type);
        xhr.onload = () => (xhr.status === 200 ? resolve(xhr) : reject(new Error(`Upload failed with status ${xhr.status}`)));
        xhr.onerror = () => reject(new Error("Upload failed"));
        xhr.send(options.file);
      });

      setUploadProgress(90);

      // 4. Criar mensagem otimista no cache
      register(tempId);
      // TODO: adicionar mensagem otimista ao cache

      // 5. Enviar para backend
      await sendWithAttachmentMutation.mutateAsync({
        chatId: options.chatId,
        content: options.caption ?? "",
        tempId,
        attachment: {
          fileName: options.file.name,
          mimeType: options.file.type,
          storagePath: signedData.storagePath,
          publicUrl: signedData.publicUrl,
          fileSize: options.file.size,
          ...dimensions,
        },
        metadata: options.metadata,
      });

      setUploadProgress(100);
      playNotificationSound();

      // NÃO invalidar queries - deixar socket trazer a mensagem completa
      // Invalidar queries causava a mensagem aparecer duas vezes:
      // 1. Primeiro só o caption (refetch)
      // 2. Depois completa com attachment (socket)
      // await queryClient.invalidateQueries({
      //   queryKey: ["messages"],
      // });
      // await queryClient.invalidateQueries({
      //   queryKey: ["chats"],
      // });

    } catch (error) {
      toast.error("Erro ao enviar mídia");
      throw error;
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [register, playNotificationSound, queryClient, getSignedUrlMutation, sendWithAttachmentMutation]);

  return { sendMedia, isUploading, uploadProgress };
}

async function extractDimensions(file: File) {
  if (file.type.startsWith("image/")) {
    return new Promise<{ width: number; height: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.width, height: img.height });
      img.src = URL.createObjectURL(file);
    });
  }

  if (file.type.startsWith("video/")) {
    return new Promise<{ width: number; height: number; duration: number }>((resolve) => {
      const video = document.createElement("video");
      video.onloadedmetadata = () => {
        resolve({
          width: video.videoWidth,
          height: video.videoHeight,
          duration: Math.round(video.duration),
        });
      };
      video.src = URL.createObjectURL(file);
    });
  }

  return {};
}
