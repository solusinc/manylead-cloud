import { useCallback } from "react";
import { v7 as uuidv7 } from "uuid";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/lib/trpc/react";
import { useMessageDeduplication } from "~/hooks/use-message-deduplication";
import { useServerSession } from "~/components/providers/session-provider";
import { useChat } from "../../providers/chat-context";

export function useSendAudio(
  _chatId: string,
  replyingTo?: {
    id: string;
    content: string;
    senderName: string;
    messageType?: string;
  } | null,
) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { register } = useMessageDeduplication();
  const session = useServerSession();
  const { chat } = useChat();

  const getSignedUrlMutation = useMutation(trpc.attachments.getSignedUploadUrl.mutationOptions());
  const sendWithAttachmentMutation = useMutation(trpc.messages.sendWithAttachment.mutationOptions());
  const sendWhatsAppMutation = useMutation(trpc.messages.sendWhatsApp.mutationOptions());

  const sendAudio = useCallback(async (audioBlob: Blob, duration: number) => {
    const tempId = uuidv7();

    try {
      // 1. Get mimeType from blob and determine file extension
      const mimeType = audioBlob.type || "audio/webm";
      const extension = mimeType.includes("ogg") ? "ogg" : "webm";
      const fileName = `audio-${Date.now()}.${extension}`;

      // 2. Get signed URL from backend
      const signedData = await getSignedUrlMutation.mutateAsync({
        fileName,
        mimeType,
        expiresIn: 300,
      });

      // 3. Upload to R2
      const xhr = new XMLHttpRequest();

      await new Promise((resolve, reject) => {
        xhr.open("PUT", signedData.uploadUrl);
        xhr.setRequestHeader("Content-Type", mimeType);
        xhr.onload = () => (xhr.status === 200 ? resolve(xhr) : reject(new Error(`Upload failed with status ${xhr.status}`)));
        xhr.onerror = () => reject(new Error("Upload failed"));
        xhr.send(audioBlob);
      });

      // 4. Add optimistic message to cache (BEFORE mutation)
      const userName = session.user.name;
      const tempMessage = {
        id: tempId,
        chatId: _chatId,
        content: "",
        senderName: userName,
        timestamp: new Date(),
        status: "pending" as const,
        sender: "agent" as const,
        senderId: null as string | null,
        messageType: "audio" as const,
        isOwnMessage: true,
        _isOptimistic: true,
        repliedToMessageId: replyingTo?.id ?? null, // Include reply-to in optimistic UI
        metadata: replyingTo
          ? {
              repliedToMessageId: replyingTo.id,
              repliedToContent: replyingTo.content,
              repliedToSender: replyingTo.senderName,
              repliedToMessageType: replyingTo.messageType ?? "text",
            }
          : null,
        attachment: {
          id: tempId,
          messageId: tempId,
          fileName,
          mimeType,
          fileSize: audioBlob.size,
          duration,
          storageUrl: signedData.publicUrl, // Show R2 URL immediately
          storagePath: signedData.storagePath,
          mediaType: "audio" as const,
          width: null,
          height: null,
          _isProcessing: true, // Flag to show Skeleton instead of player
        },
      };

      // Add to cache
      const queries = queryClient.getQueryCache().findAll({
        queryKey: [["messages", "list"]],
        exact: false,
      });

      queries.forEach((query) => {
        const queryState = query.state.data as {
          pages: {
            items: {
              message: Record<string, unknown>;
              attachment: Record<string, unknown> | null;
              isOwnMessage: boolean;
            }[];
            nextCursor: string | undefined;
            hasMore: boolean;
          }[];
          pageParams: unknown[];
        } | undefined;

        if (!queryState?.pages) return;

        const newPages = [...queryState.pages];
        const firstPage = newPages[0];

        if (firstPage) {
          newPages[0] = {
            ...firstPage,
            items: [
              ...firstPage.items,
              {
                message: tempMessage as unknown as Record<string, unknown>,
                attachment: tempMessage.attachment as unknown as Record<string, unknown>,
                isOwnMessage: true,
              },
            ],
          };

          queryClient.setQueryData(query.queryKey, {
            ...queryState,
            pages: newPages,
            pageParams: queryState.pageParams,
          });
        }
      });

      // 5. Register in deduplication store
      register(tempId);

      // 6. Send message with attachment (detect chat source)
      if (chat.source === "whatsapp") {
        // Send via WhatsApp
        await sendWhatsAppMutation.mutateAsync({
          chatId: chat.id,
          createdAt: chat.createdAt,
          content: "",

          // Reply-to (top-level field required for backend to construct quoted object)
          repliedToMessageId: replyingTo?.id,

          // Media
          mediaUrl: signedData.publicUrl,
          mimeType,
          fileName,
          fileSize: audioBlob.size,
          duration,

          // Metadata with tempId for optimistic UI replacement and reply info
          metadata: {
            tempId,
            ...(replyingTo
              ? {
                  repliedToMessageId: replyingTo.id,
                  repliedToContent: replyingTo.content,
                  repliedToSender: replyingTo.senderName,
                  repliedToMessageType: replyingTo.messageType ?? "text",
                }
              : {}),
          },
        });
      } else {
        // Send via internal (cross-org) with reply-to support
        await sendWithAttachmentMutation.mutateAsync({
          chatId: _chatId,
          content: "",
          tempId,
          attachment: {
            fileName,
            mimeType,
            storagePath: signedData.storagePath,
            publicUrl: signedData.publicUrl,
            fileSize: audioBlob.size,
            duration,
          },
          // Reply-to metadata (same format as sendText for cross-org)
          metadata: replyingTo
            ? {
                repliedToMessageId: replyingTo.id,
                repliedToContent: replyingTo.content,
                repliedToSender: replyingTo.senderName,
                repliedToMessageType: replyingTo.messageType ?? "text",
              }
            : undefined,
        });
      }

      // NOTE: Não tocar som aqui - worker ainda está processando áudio
      // Som será tocado quando Socket.io receber message:new após worker completar

    } catch (err) {
      // Remove optimistic message on error
      const queries = queryClient.getQueryCache().findAll({
        queryKey: [["messages", "list"]],
        exact: false,
      });

      queries.forEach((query) => {
        const queryState = query.state.data as {
          pages: {
            items: {
              message: Record<string, unknown>;
              attachment: Record<string, unknown> | null;
              isOwnMessage: boolean;
            }[];
            nextCursor: string | undefined;
            hasMore: boolean;
          }[];
          pageParams: unknown[];
        } | undefined;

        if (!queryState?.pages) return;

        // Remove optimistic message with tempId
        const newPages = queryState.pages.map((page) => ({
          ...page,
          items: page.items.filter((item) => item.message.id !== tempId),
        }));

        queryClient.setQueryData(query.queryKey, {
          ...queryState,
          pages: newPages,
          pageParams: queryState.pageParams,
        });
      });

      toast.error("Erro ao enviar áudio");
      throw err;
    }
  }, [_chatId, chat, getSignedUrlMutation, sendWithAttachmentMutation, sendWhatsAppMutation, register, queryClient, session.user.name, replyingTo]);

  return { sendAudio };
}
