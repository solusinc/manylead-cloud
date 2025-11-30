import { useCallback } from "react";
import { v7 as uuidv7 } from "uuid";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "~/lib/trpc/react";
import { useMessageDeduplication } from "~/hooks/use-message-deduplication";
import { useNotificationSound } from "~/hooks/use-notification-sound";

export function useSendAudio(_chatId: string) {
  const trpc = useTRPC();
  const { register } = useMessageDeduplication();
  const { playNotificationSound } = useNotificationSound();

  const getSignedUrlMutation = useMutation(trpc.attachments.getSignedUploadUrl.mutationOptions());
  const sendWithAttachmentMutation = useMutation(trpc.messages.sendWithAttachment.mutationOptions());

  const sendAudio = useCallback(async (audioBlob: Blob, duration: number) => {
    const tempId = uuidv7();

    try {
      // 1. Generate filename with timestamp
      const fileName = `audio-${Date.now()}.webm`;

      // 2. Get signed URL from backend
      const signedData = await getSignedUrlMutation.mutateAsync({
        fileName,
        mimeType: "audio/webm",
        expiresIn: 300,
      });

      // 3. Upload to R2
      const xhr = new XMLHttpRequest();

      await new Promise((resolve, reject) => {
        xhr.open("PUT", signedData.uploadUrl);
        xhr.setRequestHeader("Content-Type", "audio/webm");
        xhr.onload = () => (xhr.status === 200 ? resolve(xhr) : reject(new Error(`Upload failed with status ${xhr.status}`)));
        xhr.onerror = () => reject(new Error("Upload failed"));
        xhr.send(audioBlob);
      });

      // 4. Register in deduplication store
      register(tempId);

      // 5. Send message with attachment
      await sendWithAttachmentMutation.mutateAsync({
        chatId: _chatId,
        content: "",
        tempId,
        attachment: {
          fileName,
          mimeType: "audio/webm",
          storagePath: signedData.storagePath,
          publicUrl: signedData.publicUrl,
          fileSize: audioBlob.size,
          duration,
        },
      });

      playNotificationSound();

    } catch (err) {
      toast.error("Erro ao enviar áudio");
      throw err;
    }
  }, [_chatId, getSignedUrlMutation, sendWithAttachmentMutation, register, playNotificationSound]);

  return { sendAudio };
}
