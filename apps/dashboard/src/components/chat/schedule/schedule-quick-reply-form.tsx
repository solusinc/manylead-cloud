"use client";

import { useState, useTransition } from "react";
import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { addHours, format } from "date-fns";
import { ArrowLeft, FileText, Image, MessageSquare, Music, Zap } from "lucide-react";
import { toast } from "sonner";

import type { ScheduledMessage } from "@manylead/db";
import { Button } from "@manylead/ui/button";
import { Checkbox } from "@manylead/ui/checkbox";
import { Label } from "@manylead/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@manylead/ui/select";

import { useTRPC } from "~/lib/trpc/react";
import { useServerSession } from "~/components/providers/session-provider";
import { useChat } from "../providers/chat-context";
import { useScheduleMutations } from "./hooks";

interface ScheduleQuickReplyFormProps {
  onCancel: () => void;
  onSuccess: () => void;
  editingItem?: {
    scheduledMessage: ScheduledMessage;
    createdByAgent: unknown;
  } | null;
}

export function ScheduleQuickReplyForm({
  onCancel,
  onSuccess,
  editingItem,
}: ScheduleQuickReplyFormProps) {
  const trpc = useTRPC();
  const { chat } = useChat();
  const session = useServerSession();
  const { create, update } = useScheduleMutations();
  const [isPending, startTransition] = useTransition();

  // Data padrão: 1 hora a partir de agora ou data do item sendo editado
  const schedule = editingItem?.scheduledMessage;

  const [selectedQuickReplyId, setSelectedQuickReplyId] = useState<string>(
    schedule?.quickReplyId ?? ""
  );

  // Buscar quick replies disponíveis
  const { data: quickReplies = [], isLoading: isLoadingQuickReplies } = useQuery(
    trpc.quickReplies.listAvailableForScheduling.queryOptions(),
  );

  // Buscar timezone da organização
  const { data: settings } = useQuery(
    trpc.organizationSettings.get.queryOptions(),
  );
  const timezone = settings?.timezone ?? "America/Sao_Paulo";

  // Buscar nome da organização
  const { data: currentOrganization } = useQuery(
    trpc.organization.getCurrent.queryOptions(),
  );

  // Dados para substituição de variáveis no preview
  const contactName = chat.contact.name || chat.contact.phoneNumber;
  const agentName = session.user.name;
  const organizationName = currentOrganization?.name ?? "";
  const defaultDateTime = schedule
    ? format(new Date(schedule.scheduledAt), "yyyy-MM-dd'T'HH:mm")
    : format(addHours(new Date(), 1), "yyyy-MM-dd'T'HH:mm");

  const form = useForm({
    defaultValues: {
      quickReplyId: schedule?.quickReplyId ?? "",
      scheduledAt: defaultDateTime,
      cancelOnContactMessage: schedule?.cancelOnContactMessage ?? false,
      cancelOnAgentMessage: schedule?.cancelOnAgentMessage ?? false,
      cancelOnChatClose: schedule?.cancelOnChatClose ?? false,
    },
    onSubmit: ({ value }) => {
      if (isPending) return;

      // Validar data no futuro
      const scheduledDate = new Date(value.scheduledAt);
      if (scheduledDate <= new Date()) {
        toast.error("Data deve ser no futuro");
        return;
      }

      // Validar quick reply selecionada
      if (!value.quickReplyId) {
        toast.error("Selecione uma resposta rápida");
        return;
      }

      startTransition(async () => {
        try {
          const selectedQuickReply = quickReplies.find(
            (qr) => qr.id === value.quickReplyId,
          );

          if (!selectedQuickReply) {
            toast.error("Resposta rápida não encontrada");
            return;
          }

          if (editingItem) {
            // Atualização
            await update.mutateAsync({
              id: editingItem.scheduledMessage.id,
              quickReplyId: value.quickReplyId,
              scheduledAt: scheduledDate,
              cancelOnContactMessage: value.cancelOnContactMessage,
              cancelOnAgentMessage: value.cancelOnAgentMessage,
              cancelOnChatClose: value.cancelOnChatClose,
            });

            toast.success("Agendamento atualizado com sucesso");
          } else {
            // Criação
            await create.mutateAsync({
              chatId: chat.id,
              chatCreatedAt: chat.createdAt,
              contentType: "message",
              content: selectedQuickReply.content, // Preview do conteúdo
              scheduledAt: scheduledDate,
              timezone,
              quickReplyId: value.quickReplyId,
              cancelOnContactMessage: value.cancelOnContactMessage,
              cancelOnAgentMessage: value.cancelOnAgentMessage,
              cancelOnChatClose: value.cancelOnChatClose,
            });

            toast.success("Resposta rápida agendada com sucesso");
          }

          onSuccess();
        } catch (error) {
          console.error("Erro ao agendar resposta rápida:", error);
          toast.error("Erro ao agendar resposta rápida");
        }
      });
    },
  });

  const selectedQuickReply = quickReplies.find((qr) => qr.id === selectedQuickReplyId);

  // Função para substituir variáveis no preview
  const replaceVariables = (content: string) => {
    return content
      .replace(/\{\{contact\.name\}\}/g, contactName)
      .replace(/\{\{agent\.name\}\}/g, agentName)
      .replace(/\{\{organization\.name\}\}/g, organizationName);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void form.handleSubmit();
      }}
      className="space-y-6 p-4"
    >
      {/* Data e Hora */}
      <div className="space-y-2">
        <Label htmlFor="scheduledAt">Data e Hora *</Label>
        <form.Field name="scheduledAt">
          {(field) => (
            <input
              id="scheduledAt"
              type="datetime-local"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          )}
        </form.Field>
      </div>

      {/* Seletor de Quick Reply */}
      <div className="space-y-2">
        <Label htmlFor="quickReplyId">Resposta Rápida *</Label>
        <form.Field name="quickReplyId">
          {(field) => (
            <Select
              value={field.state.value}
              onValueChange={(value) => {
                field.handleChange(value);
                setSelectedQuickReplyId(value);
              }}
              disabled={isLoadingQuickReplies}
            >
              <SelectTrigger id="quickReplyId">
                <SelectValue placeholder="Selecione uma resposta rápida" />
              </SelectTrigger>
              <SelectContent>
                {quickReplies.map((qr) => (
                  <SelectItem key={qr.id} value={qr.id}>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">
                        {qr.shortcut}
                      </span>
                      <span>{qr.title}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </form.Field>
      </div>

      {/* Preview da Quick Reply */}
      {selectedQuickReply && (
        <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Zap className="h-4 w-4" />
            <span>Preview</span>
          </div>
          <div className="space-y-1 text-sm text-muted-foreground">
            <p className="font-medium">
              {selectedQuickReply.messages.length}{" "}
              {selectedQuickReply.messages.length === 1 ? "mensagem" : "mensagens"}
            </p>
            {selectedQuickReply.messages.slice(0, 2).map((msg, idx) => {
              const hasMedia = msg.mediaUrl && msg.type !== "text";

              const TypeIcon =
                msg.type === "image"
                  ? Image
                  : msg.type === "audio"
                    ? Music
                    : msg.type === "document"
                      ? FileText
                      : MessageSquare;

              const typeLabel =
                msg.type === "image"
                  ? "Imagem"
                  : msg.type === "audio"
                    ? "Áudio"
                    : msg.type === "document"
                      ? "Documento"
                      : "Texto";

              return (
                <div
                  key={idx}
                  className="rounded border bg-background p-2 text-xs"
                >
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <TypeIcon className="h-3 w-3" />
                    <span>{typeLabel}</span>
                  </div>
                  <p className="mt-1 line-clamp-2">
                    {hasMedia && msg.content
                      ? replaceVariables(msg.content)
                      : hasMedia
                        ? msg.mediaName ?? "[mídia]"
                        : msg.content
                          ? replaceVariables(msg.content)
                          : "[sem conteúdo]"}
                  </p>
                </div>
              );
            })}
            {selectedQuickReply.messages.length > 2 && (
              <p className="text-xs text-muted-foreground">
                +{selectedQuickReply.messages.length - 2} mais...
              </p>
            )}
          </div>
        </div>
      )}

      {/* Opções de cancelamento automático */}
      <div className="space-y-3 rounded-lg border p-3">
        <p className="text-sm font-medium">Cancelar automaticamente se:</p>

        <form.Field name="cancelOnContactMessage">
          {(field) => (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="cancelOnContactMessage"
                checked={field.state.value}
                onCheckedChange={(checked) => field.handleChange(checked === true)}
              />
              <Label
                htmlFor="cancelOnContactMessage"
                className="cursor-pointer text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Contato enviar nova mensagem
              </Label>
            </div>
          )}
        </form.Field>

        <form.Field name="cancelOnAgentMessage">
          {(field) => (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="cancelOnAgentMessage"
                checked={field.state.value}
                onCheckedChange={(checked) => field.handleChange(checked === true)}
              />
              <Label
                htmlFor="cancelOnAgentMessage"
                className="cursor-pointer text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Atendente enviar nova mensagem
              </Label>
            </div>
          )}
        </form.Field>

        <form.Field name="cancelOnChatClose">
          {(field) => (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="cancelOnChatClose"
                checked={field.state.value}
                onCheckedChange={(checked) => field.handleChange(checked === true)}
              />
              <Label
                htmlFor="cancelOnChatClose"
                className="cursor-pointer text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Conversa for finalizada
              </Label>
            </div>
          )}
        </form.Field>
      </div>

      {/* Botões */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isPending}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <Button type="submit" disabled={isPending} className="flex-1">
          {isPending
            ? "Agendando..."
            : editingItem
              ? "Salvar alterações"
              : "Agendar"}
        </Button>
      </div>
    </form>
  );
}
