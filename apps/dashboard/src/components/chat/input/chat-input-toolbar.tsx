"use client";

import type { EmojiClickData } from "emoji-picker-react";
import { useState } from "react";
import EmojiPicker from "emoji-picker-react";
import { Smile, Plus, MessageSquareText, FileText, Image as ImageIcon } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

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
      <ChatInputAttachButton chatId={chatId} onFileSelect={onFileSelect} />
      <ChatInputEmojiButton onEmojiSelect={onEmojiSelect} />
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
  const [open, setOpen] = useState(false);

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    onEmojiSelect?.(emojiData.emoji);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:text-foreground", className)}
          aria-label="Add emoji"
          {...props}
        >
          <Smile className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full border-0 p-0" side="top" align="start">
        <EmojiPicker
          onEmojiClick={handleEmojiClick}
          width="100%"
          height={400}
          previewConfig={{ showPreview: false }}
        />
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
  const [open, setOpen] = useState(false);
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, _type: string) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect?.(file);
      setOpen(false);
    }
  };

  return (
    <>
      {/* Dialog inline para comentários */}
      <CommentDialogInline
        chatId={chatId}
        open={commentDialogOpen}
        onOpenChange={setCommentDialogOpen}
      />

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:text-foreground", className)}
            aria-label="Attach"
            {...props}
          >
            <Plus className="h-5 w-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2" side="top" align="start">
          <div className="space-y-1">
            <AttachMenuOption
              icon={MessageSquareText}
              label="Comentário"
              onClick={() => {
                setOpen(false);
                setCommentDialogOpen(true);
              }}
            />
            <AttachMenuOption
              icon={FileText}
              label="Documento"
              inputId="document-upload"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
              onChange={(e) => handleFileChange(e, "document")}
            />
            <AttachMenuOption
              icon={ImageIcon}
              label="Foto e Vídeo"
              inputId="media-upload"
              accept="image/*,video/*"
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
        <Icon className="h-5 w-5" />
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
        toast.success("Comentário adicionado");
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
