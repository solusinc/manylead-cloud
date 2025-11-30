"use client";

import { useState } from "react";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import { Smile, Plus, MessageSquareText, File, Image as ImageIcon } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useDisclosure } from "~/hooks/use-disclosure";

import { cn } from "@manylead/ui";
import { Button } from "@manylead/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@manylead/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@manylead/ui/dialog";
import { Textarea } from "@manylead/ui/textarea";
import { MEDIA_LIMITS, formatFileSize, isValidMediaFile } from "@manylead/shared/constants";

import { useTRPC } from "~/lib/trpc/react";

export function ChatInputToolbar({
  chatId,
  onEmojiSelect,
  onFileSelect,
  className,
  ...props
}: {
  chatId: string;
  onEmojiSelect?: (emoji: string) => void;
  onFileSelect?: (file: File) => void;
} & React.ComponentProps<"div">) {
  return (
    <div className={cn("flex items-center pl-1", className)} {...props}>
      <ChatInputEmojiButton onEmojiSelect={onEmojiSelect} />
      <ChatInputAttachButton chatId={chatId} onFileSelect={onFileSelect} />
    </div>
  );
}

export function ChatInputEmojiButton({
  onEmojiSelect,
  className,
  ...props
}: {
  onEmojiSelect?: (emoji: string) => void;
} & React.ComponentProps<typeof Button>) {
  const { isOpen, setIsOpen, onClose } = useDisclosure();

  const handleEmojiClick = (emoji: { native: string }) => {
    onEmojiSelect?.(emoji.native);
    onClose();
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:text-foreground", className)}
          aria-label="Add emoji"
          {...props}
        >
          <Smile className="size-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full border-0 p-0 bg-transparent" side="top" align="start" sideOffset={16}>
        <div className="overflow-hidden rounded-lg">
          <Picker
            data={data}
            onEmojiSelect={handleEmojiClick}
            theme="dark"
            previewPosition="bottom"
            emojiSize={20}
            emojiButtonSize={36}
            maxFrequentRows={2}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function ChatInputAttachButton({
  chatId,
  onFileSelect,
  className,
  ...props
}: {
  chatId: string;
  onFileSelect?: (file: File) => void;
} & React.ComponentProps<typeof Button>) {
  const { isOpen, setIsOpen, onClose } = useDisclosure();
  const commentDialog = useDisclosure();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar mídia (foto/vídeo)
    if (type === "media") {
      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");

      if (!isImage && !isVideo) {
        toast.error("Arquivo inválido", {
          description: "Selecione apenas fotos ou vídeos",
        });
        return;
      }

      // Validar usando MEDIA_LIMITS
      const mediaType = isImage ? "IMAGE" : "VIDEO";
      if (!isValidMediaFile(file, mediaType)) {
        const maxSize = MEDIA_LIMITS[mediaType].MAX_SIZE_BYTES;
        toast.error("Arquivo muito grande", {
          description: `Máximo: ${formatFileSize(maxSize)}`,
        });
        return;
      }
    }

    // Validar documento
    if (type === "document") {
      if (!isValidMediaFile(file, "DOCUMENT")) {
        toast.error("Arquivo muito grande", {
          description: `Máximo: ${formatFileSize(MEDIA_LIMITS.DOCUMENT.MAX_SIZE_BYTES)}`,
        });
        return;
      }
    }

    // Enviar arquivo (mídia ou documento) para preview
    onFileSelect?.(file);
    onClose();
    e.target.value = "";
  };

  return (
    <>
      {/* Dialog inline para comentários */}
      <CommentDialogInline
        chatId={chatId}
        open={commentDialog.isOpen}
        onOpenChange={commentDialog.setIsOpen}
      />

      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:text-foreground", className)}
            aria-label="Attach"
            {...props}
          >
            <Plus className="size-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2" side="top" align="start" sideOffset={16}>
          <div className="space-y-1">
            <AttachMenuOption
              icon={MessageSquareText}
              label="Comentário"
              onClick={() => {
                onClose();
                commentDialog.onOpen();
              }}
            />
            <AttachMenuOption
              icon={File}
              label="Documento"
              inputId="document-upload"
              accept={MEDIA_LIMITS.DOCUMENT.ALLOWED_TYPES.join(",")}
              onChange={(e) => handleFileChange(e, "document")}
            />
            <AttachMenuOption
              icon={ImageIcon}
              label="Foto e Vídeo"
              inputId="media-upload"
              accept={[...MEDIA_LIMITS.IMAGE.ALLOWED_TYPES, ...MEDIA_LIMITS.VIDEO.ALLOWED_TYPES].join(",")}
              onChange={(e) => handleFileChange(e, "media")}
            />
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}

function AttachMenuOption({
  icon: Icon,
  label,
  onClick,
  inputId,
  accept,
  onChange,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
  inputId?: string;
  accept?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <>
      {inputId && (
        <input
          type="file"
          id={inputId}
          className="hidden"
          accept={accept}
          onChange={onChange}
        />
      )}
      <button
        onClick={inputId ? () => document.getElementById(inputId)?.click() : onClick}
        className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-accent"
      >
        <Icon className="h-5 w-5 text-muted-foreground" />
        <span>{label}</span>
      </button>
    </>
  );
}

/**
 * Dialog inline para comentários - usa mesma lógica do ChatCommentDialog
 */
function CommentDialogInline({
  chatId,
  open,
  onOpenChange,
}: {
  chatId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [comment, setComment] = useState("");
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const addCommentMutation = useMutation(
    trpc.messages.addComment.mutationOptions({
      onSuccess: () => {
        setComment("");
        onOpenChange(false);
        void queryClient.invalidateQueries({ queryKey: [["messages", "list"]] });
      },
      onError: (error) => {
        toast.error(error.message || "Erro ao adicionar comentário");
      },
    }),
  );

  const handleSubmit = () => {
    if (!comment.trim()) {
      toast.error("Digite um comentário");
      return;
    }

    addCommentMutation.mutate({
      chatId,
      content: comment.trim(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Inserir comentário</DialogTitle>
          <DialogDescription>
            Este comentário é privado e não será enviado ao cliente
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Textarea
            placeholder="Digite seu comentário..."
            value={comment}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setComment(e.target.value)}
            rows={4}
            className="resize-none"
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={addCommentMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={addCommentMutation.isPending || !comment.trim()}
          >
            {addCommentMutation.isPending ? "Adicionando..." : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
