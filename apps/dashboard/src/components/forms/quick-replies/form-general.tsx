"use client";

import { useTransition, useState, useRef, useCallback } from "react";
import Image from "next/image";
import { useForm } from "@tanstack/react-form";
import { isTRPCClientError } from "@trpc/client";
import { toast } from "sonner";
import { z } from "zod";
import {
  ChevronDown,
  ChevronUp,
  FileText,
  Image as ImageIcon,
  MessageSquare,
  Mic,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import {
  Button,
  Input,
  Label,
  Textarea,
} from "@manylead/ui";
import { RadioGroup, RadioGroupItem } from "@manylead/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@manylead/ui/select";

import {
  FormCard,
  FormCardContent,
  FormCardDescription,
  FormCardFooter,
  FormCardHeader,
  FormCardSeparator,
  FormCardTitle,
} from "~/components/forms/form-card";

import type { QuickReplyContentType, QuickReplyMessage } from "@manylead/db/schema";
import {
  QUICK_REPLY_CONTENT_TYPES,
  QUICK_REPLY_CONTENT_TYPE_LABELS,
} from "@manylead/db/schema";
import { useMutation } from "@tanstack/react-query";

import { useUploadQuickReplyMedia } from "./hooks/use-upload-quick-reply-media";
import { useTRPC } from "~/lib/trpc/react";

const messageSchema = z.object({
  type: z.enum(QUICK_REPLY_CONTENT_TYPES),
  content: z.string(),
  mediaUrl: z.string().optional().nullable(),
  mediaName: z.string().optional().nullable(),
  mediaMimeType: z.string().optional().nullable(),
}).refine(
  (data) => {
    // Para texto, content é obrigatório
    if (data.type === "text") {
      return data.content.trim().length > 0;
    }
    // Para mídia, ou tem content ou tem mediaUrl
    return data.content.trim().length > 0 || data.mediaUrl;
  },
  {
    message: "Adicione um conteúdo ou selecione um arquivo",
    path: ["content"],
  }
);

const schema = z.object({
  shortcut: z
    .string()
    .min(1, "Atalho é obrigatório")
    .max(49, "Atalho deve ter no máximo 49 caracteres")
    .regex(
      /^[a-z0-9_-]+$/,
      "Atalho deve conter apenas letras minúsculas, números, _ ou -",
    ),
  title: z
    .string()
    .min(1, "Título é obrigatório")
    .max(200, "Título deve ter no máximo 200 caracteres"),
  messages: z.array(messageSchema).min(1, "Adicione pelo menos uma mensagem"),
  visibility: z.enum(["organization", "private"]),
});

type FormValues = z.infer<typeof schema>;

const CONTENT_TYPE_ICONS: Record<QuickReplyContentType, React.ElementType> = {
  text: MessageSquare,
  image: ImageIcon,
  audio: Mic,
  document: FileText,
};

function MessageItem({
  message,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
  onTextareaRef,
  onFocus,
}: {
  message: QuickReplyMessage;
  onUpdate: (message: QuickReplyMessage) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
  onTextareaRef?: (el: HTMLTextAreaElement | null) => void;
  onFocus?: () => void;
}) {
  const Icon = CONTENT_TYPE_ICONS[message.type];
  const typeLabel = QUICK_REPLY_CONTENT_TYPE_LABELS[message.type];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const trpc = useTRPC();

  // Mutation para deletar mídia do R2
  const deleteMediaMutation = useMutation(
    trpc.quickReplies.deleteMedia.mutationOptions(),
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // TODO: Upload to storage and get URL
    // Por enquanto, vamos criar uma URL temporária
    const reader = new FileReader();
    reader.onload = () => {
      onUpdate({
        ...message,
        mediaUrl: reader.result as string,
        mediaName: file.name,
        mediaMimeType: file.type,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveFile = () => {
    // Opção 1: Deletar do R2 ao remover do form
    if (message.mediaUrl?.startsWith("http")) {
      // Deletar do R2 em background (não esperar)
      deleteMediaMutation.mutate({ publicUrl: message.mediaUrl });
    }

    // Remover do form
    onUpdate({
      ...message,
      mediaUrl: null,
      mediaName: null,
      mediaMimeType: null,
    });
  };

  const isImage = message.type === "image";
  const isDocument = message.type === "document";
  const isAudio = message.type === "audio";
  const hasMedia = isImage || isDocument || isAudio;

  return (
    <div className="relative rounded-lg border bg-muted/30 p-4">
      {/* Header com tipo e botões */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{typeLabel}</span>
        </div>
        <div className="flex items-center gap-1">
          {/* Reorder buttons */}
          <div className="flex flex-col">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              disabled={isFirst}
              onClick={onMoveUp}
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              disabled={isLast}
              onClick={onMoveDown}
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
          {/* Delete button */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content area */}
      <div className="space-y-3">
        {/* File upload for media types */}
        {hasMedia && (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept={
                isImage
                  ? "image/*"
                  : isAudio
                    ? "audio/*"
                    : ".pdf,.doc,.docx,.xls,.xlsx,.txt"
              }
              onChange={handleFileChange}
            />
            {message.mediaUrl ? (
              <div className="relative rounded-lg border bg-background p-3">
                <div className="flex items-start gap-3">
                  {isImage && (
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded">
                      <Image
                        src={message.mediaUrl}
                        alt={message.mediaName ?? "Preview"}
                        fill
                        className="object-cover"
                      />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {message.mediaName ?? "Arquivo"}
                    </p>
                    {message.mediaMimeType && (
                      <p className="text-xs text-muted-foreground">
                        {message.mediaMimeType}
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={handleRemoveFile}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-1/2"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                Selecionar {isImage ? "imagem ou vídeo" : isAudio ? "áudio" : "documento"}
              </Button>
            )}
          </div>
        )}

        {/* Caption/content textarea */}
        <Textarea
          ref={onTextareaRef}
          value={message.content}
          onChange={(e) => onUpdate({ ...message, content: e.target.value })}
          onFocus={onFocus}
          placeholder={
            hasMedia
              ? "Legenda (opcional)"
              : "Olá {{contact.name}}, como posso ajudar?"
          }
          rows={hasMedia ? 2 : 3}
        />
      </div>
    </div>
  );
}

const AVAILABLE_VARIABLES = [
  { label: "Nome do lead", value: "{{contact.name}}" },
  { label: "Seu nome", value: "{{agent.name}}" },
  { label: "Nome da sua empresa", value: "{{organization.name}}" },
] as const;

export function FormGeneral({
  onSubmitAction,
  defaultValues,
}: {
  onSubmitAction: (values: FormValues & { shortcut: string }) => Promise<void>;
  defaultValues?: Partial<FormValues & { messages?: QuickReplyMessage[] }>;
}) {
  const [isPending, startTransition] = useTransition();
  const [newMessageType, setNewMessageType] = useState<QuickReplyContentType>("text");
  const [lastFocusedMessageIndex, setLastFocusedMessageIndex] = useState<number | null>(null);
  const textareaRefs = useRef<Map<number, HTMLTextAreaElement>>(new Map());
  const { uploadMessages, isUploading, progress } = useUploadQuickReplyMedia();

  const form = useForm({
    defaultValues: {
      shortcut: defaultValues?.shortcut?.replace(/^\//, "") ?? "",
      title: defaultValues?.title ?? "",
      messages: defaultValues?.messages ?? [],
      visibility: defaultValues?.visibility ?? "organization",
    },
    onSubmit: ({ value }) => {
      if (isPending || isUploading) return;

      // Validar mensagens
      if (value.messages.length === 0) {
        toast.error("Adicione pelo menos uma mensagem");
        return;
      }

      startTransition(async () => {
        try {
          // 1. Fazer upload de todas as mídias primeiro
          let uploadedMessages = value.messages;
          try {
            uploadedMessages = await uploadMessages(value.messages);
          } catch (error) {
            if (error instanceof Error) {
              toast.error(error.message);
            } else {
              toast.error("Erro ao fazer upload das mídias");
            }
            return; // Não submeter o form se upload falhar
          }

          // 2. Submeter com as URLs do R2
          const submitValues = {
            ...value,
            messages: uploadedMessages,
            shortcut: `/${value.shortcut}`,
          };

          const promise = onSubmitAction(submitValues);
          toast.promise(promise, {
            loading: "Salvando...",
            success: () => "Resposta rápida salva com sucesso",
            error: (error) => {
              if (isTRPCClientError(error)) {
                return error.message;
              }
              return "Falha ao salvar resposta rápida";
            },
          });
          await promise;
        } catch (error) {
          console.error(error);
        }
      });
    },
  });

  const addMessage = () => {
    const newMessage: QuickReplyMessage = {
      type: newMessageType,
      content: "",
      mediaUrl: null,
      mediaName: null,
      mediaMimeType: null,
    };
    form.setFieldValue("messages", [...form.getFieldValue("messages"), newMessage]);
  };

  const updateMessage = (index: number, message: QuickReplyMessage) => {
    const messages = [...form.getFieldValue("messages")];
    messages[index] = message;
    form.setFieldValue("messages", messages);
  };

  const deleteMessage = (index: number) => {
    const messages = form.getFieldValue("messages").filter((_, i) => i !== index);
    form.setFieldValue("messages", messages);
  };

  const moveMessage = (index: number, direction: "up" | "down") => {
    const messages = [...form.getFieldValue("messages")];
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= messages.length) return;
    const current = messages[index];
    const target = messages[newIndex];
    if (current && target) {
      messages[index] = target;
      messages[newIndex] = current;
      form.setFieldValue("messages", messages);
    }
  };

  const insertVariable = useCallback((variable: string) => {
    const messages = form.getFieldValue("messages");

    // Se não tem mensagens, cria uma nova com a variável
    if (messages.length === 0) {
      const newMessage: QuickReplyMessage = {
        type: "text",
        content: variable,
        mediaUrl: null,
        mediaName: null,
        mediaMimeType: null,
      };
      form.setFieldValue("messages", [newMessage]);
      setLastFocusedMessageIndex(0);
      return;
    }

    // Usa a última mensagem focada ou a primeira
    const targetIndex = lastFocusedMessageIndex ?? 0;
    const textarea = textareaRefs.current.get(targetIndex);
    const message = messages[targetIndex];

    if (!message) return;

    let newContent: string;
    let newCursorPosition: number;

    if (textarea) {
      // Insere na posição do cursor
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const currentContent = message.content;
      newContent = currentContent.slice(0, start) + variable + currentContent.slice(end);
      newCursorPosition = start + variable.length;
    } else {
      // Adiciona no final
      newContent = message.content + variable;
      newCursorPosition = newContent.length;
    }

    // Atualiza a mensagem
    const updatedMessages = [...messages];
    updatedMessages[targetIndex] = { ...message, content: newContent };
    form.setFieldValue("messages", updatedMessages);

    // Reposiciona o cursor após o React atualizar
    setTimeout(() => {
      const updatedTextarea = textareaRefs.current.get(targetIndex);
      if (updatedTextarea) {
        updatedTextarea.focus();
        updatedTextarea.setSelectionRange(newCursorPosition, newCursorPosition);
      }
    }, 0);
  }, [form, lastFocusedMessageIndex]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <FormCard>
        <FormCardHeader>
          <FormCardTitle>Informações da resposta rápida</FormCardTitle>
          <FormCardDescription>
            Configure o atalho e conteúdo da resposta rápida.
          </FormCardDescription>
        </FormCardHeader>
        <FormCardSeparator />
        <FormCardContent>
          <div className="grid gap-6">
            {/* Acionador (shortcut) */}
            <form.Field
              name="shortcut"
              validators={{
                onChange: ({ value }) => {
                  const result = schema.shape.shortcut.safeParse(value);
                  if (!result.success) {
                    return result.error.issues[0]?.message ?? "Erro de validação";
                  }
                  return undefined;
                },
              }}
            >
              {(field) => (
                <div className="grid gap-2">
                  <Label htmlFor={field.name}>Acionador</Label>
                  <p className="text-sm text-muted-foreground">
                    Durante um atendimento, digite barra (/) mais o nome do
                    atalho para acionar sua resposta rápida.
                  </p>
                  <div className="flex items-stretch">
                    <span className="flex items-center rounded-l-md border border-r-0 bg-muted px-3 text-muted-foreground">
                      /
                    </span>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) =>
                        field.handleChange(e.target.value.toLowerCase())
                      }
                      placeholder="bem_vindo"
                      className="rounded-l-none"
                    />
                  </div>
                  {field.state.meta.errors.length > 0 ? (
                    <p className="text-destructive text-sm">
                      {field.state.meta.errors[0]}
                    </p>
                  ) : null}
                </div>
              )}
            </form.Field>

            {/* Título */}
            <form.Field
              name="title"
              validators={{
                onChange: ({ value }) => {
                  const result = schema.shape.title.safeParse(value);
                  if (!result.success) {
                    return result.error.issues[0]?.message ?? "Erro de validação";
                  }
                  return undefined;
                },
              }}
            >
              {(field) => (
                <div className="grid gap-2">
                  <Label htmlFor={field.name}>Título</Label>
                  <p className="text-sm text-muted-foreground">
                    Um nome para identificar sua resposta rápida.
                  </p>
                  <Input
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Mensagem de boas vindas"
                  />
                  {field.state.meta.errors.length > 0 ? (
                    <p className="text-destructive text-sm">
                      {field.state.meta.errors[0]}
                    </p>
                  ) : null}
                </div>
              )}
            </form.Field>

            {/* Compartilhado (visibility) */}
            <form.Field name="visibility">
              {(field) => (
                <div className="grid gap-2">
                  <Label>Compartilhado</Label>
                  <RadioGroup
                    value={field.state.value}
                    onValueChange={(value) =>
                      field.handleChange(value as "organization" | "private")
                    }
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="organization" id="organization" />
                      <Label htmlFor="organization" className="font-normal">
                        Para todos
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="private" id="private" />
                      <Label htmlFor="private" className="font-normal">
                        Apenas para mim
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              )}
            </form.Field>

            {/* Mensagens */}
            <div className="grid gap-4">
              <div>
                <Label>Mensagem</Label>
                <p className="text-sm text-muted-foreground">
                  Adicione uma ou mais mensagens que serão enviadas em sequência.
                </p>
              </div>

              {/* Variáveis disponíveis - clicáveis */}
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>Clique para inserir:</span>
                {AVAILABLE_VARIABLES.map((variable) => (
                  <Button
                    key={variable.value}
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => insertVariable(variable.value)}
                    className="h-auto px-2 py-0.5 text-xs"
                  >
                    {variable.label}
                  </Button>
                ))}
              </div>

              {/* Lista de mensagens */}
              <form.Field name="messages">
                {(field) => (
                  <div className="space-y-3">
                    {field.state.value.map((message, index) => (
                      <MessageItem
                        key={index}
                        message={message}
                        onUpdate={(updated) => updateMessage(index, updated)}
                        onDelete={() => deleteMessage(index)}
                        onMoveUp={() => moveMessage(index, "up")}
                        onMoveDown={() => moveMessage(index, "down")}
                        isFirst={index === 0}
                        isLast={index === field.state.value.length - 1}
                        onTextareaRef={(el) => {
                          if (el) {
                            textareaRefs.current.set(index, el);
                          } else {
                            textareaRefs.current.delete(index);
                          }
                        }}
                        onFocus={() => setLastFocusedMessageIndex(index)}
                      />
                    ))}

                    {field.state.value.length === 0 && (
                      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                        Nenhuma mensagem adicionada. Adicione pelo menos uma mensagem abaixo.
                      </div>
                    )}
                  </div>
                )}
              </form.Field>

              {/* Adicionar mensagem */}
              <div className="flex items-center gap-2">
                <Select
                  value={newMessageType}
                  onValueChange={(value) =>
                    setNewMessageType(value as QuickReplyContentType)
                  }
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {QUICK_REPLY_CONTENT_TYPES.map((type) => {
                      const Icon = CONTENT_TYPE_ICONS[type];
                      return (
                        <SelectItem key={type} value={type}>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            {QUICK_REPLY_CONTENT_TYPE_LABELS[type]}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <Button type="button" variant="default" onClick={addMessage}>
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar
                </Button>
              </div>
            </div>
          </div>
        </FormCardContent>
        <FormCardFooter>
          {isUploading && progress.total > 0 && (
            <div className="flex-1 text-sm text-muted-foreground">
              Fazendo upload: {progress.completed + progress.failed}/{progress.total}
              {progress.current && <span className="ml-2">({progress.current})</span>}
            </div>
          )}
          <Button type="submit" size="sm" disabled={isPending || isUploading}>
            {isUploading
              ? `Uploading... ${progress.completed}/${progress.total}`
              : isPending
                ? "Salvando..."
                : "Salvar"}
          </Button>
        </FormCardFooter>
      </FormCard>
    </form>
  );
}
