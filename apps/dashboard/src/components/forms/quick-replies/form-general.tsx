"use client";

import { useTransition, useState, useRef, useCallback } from "react";
import { useForm } from "@tanstack/react-form";
import { isTRPCClientError } from "@trpc/client";
import { toast } from "sonner";
import { z } from "zod";
import {
  ChevronDown,
  ChevronUp,
  FileText,
  Image,
  MapPin,
  MessageSquare,
  Mic,
  Plus,
  Trash2,
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

const messageSchema = z.object({
  type: z.enum(QUICK_REPLY_CONTENT_TYPES),
  content: z.string().min(1, "Conteúdo é obrigatório"),
  mediaUrl: z.string().url().optional().nullable(),
  mediaName: z.string().optional().nullable(),
  mediaMimeType: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  locationName: z.string().optional().nullable(),
  locationAddress: z.string().optional().nullable(),
});

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
  image: Image,
  audio: Mic,
  document: FileText,
  location: MapPin,
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
            className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content - apenas texto por enquanto */}
      <Textarea
        ref={onTextareaRef}
        value={message.content}
        onChange={(e) => onUpdate({ ...message, content: e.target.value })}
        onFocus={onFocus}
        placeholder="Olá {{contact.name}}, como posso ajudar?"
        rows={3}
      />
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

  const form = useForm({
    defaultValues: {
      shortcut: defaultValues?.shortcut?.replace(/^\//, "") ?? "",
      title: defaultValues?.title ?? "",
      messages: defaultValues?.messages ?? [],
      visibility: defaultValues?.visibility ?? "organization",
    },
    onSubmit: ({ value }) => {
      if (isPending) return;

      // Validar mensagens
      if (value.messages.length === 0) {
        toast.error("Adicione pelo menos uma mensagem");
        return;
      }

      startTransition(async () => {
        try {
          const submitValues = {
            ...value,
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
      latitude: null,
      longitude: null,
      locationName: null,
      locationAddress: null,
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
        latitude: null,
        longitude: null,
        locationName: null,
        locationAddress: null,
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
                      const isDisabled = type !== "text";
                      return (
                        <SelectItem key={type} value={type} disabled={isDisabled}>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            {QUICK_REPLY_CONTENT_TYPE_LABELS[type]}
                            {isDisabled && <span className="text-xs text-muted-foreground">(em breve)</span>}
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
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? "Salvando..." : "Salvar"}
          </Button>
        </FormCardFooter>
      </FormCard>
    </form>
  );
}
