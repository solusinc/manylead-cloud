"use client";

import { useTransition } from "react";
import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import { addHours, format } from "date-fns";
import { ArrowLeft } from "lucide-react";

import type { ScheduledMessage } from "@manylead/db";
import { Button } from "@manylead/ui/button";
import { toast } from "sonner";
import { Checkbox } from "@manylead/ui/checkbox";
import { Label } from "@manylead/ui/label";
import { Textarea } from "@manylead/ui/textarea";

import { useTRPC } from "~/lib/trpc/react";
import { useChat } from "../providers/chat-context";
import { useScheduleMutations } from "./hooks";

interface ScheduleFormProps {
  contentType: "message" | "comment";
  onCancel: () => void;
  onSuccess: () => void;
  editingItem?: {
    scheduledMessage: ScheduledMessage;
    createdByAgent: unknown;
  } | null;
}

export function ScheduleForm({
  contentType,
  onCancel,
  onSuccess,
  editingItem,
}: ScheduleFormProps) {
  const trpc = useTRPC();
  const { chat } = useChat();
  const { create, update } = useScheduleMutations();
  const [isPending, startTransition] = useTransition();

  // Buscar timezone da organização
  const { data: settings } = useQuery(
    trpc.organizationSettings.get.queryOptions(),
  );
  const timezone = settings?.timezone ?? "America/Sao_Paulo";

  // Data padrão: 1 hora a partir de agora ou data do item sendo editado
  const schedule = editingItem?.scheduledMessage;
  const defaultDateTime = schedule
    ? format(new Date(schedule.scheduledAt), "yyyy-MM-dd'T'HH:mm")
    : format(addHours(new Date(), 1), "yyyy-MM-dd'T'HH:mm");

  const form = useForm({
    defaultValues: {
      content: schedule?.content ?? "",
      scheduledAt: defaultDateTime,
      cancelOnContactMessage: schedule?.cancelOnContactMessage ?? false,
      cancelOnAgentMessage: schedule?.cancelOnAgentMessage ?? false,
      cancelOnChatClose: schedule?.cancelOnChatClose ?? false,
    },
    onSubmit: ({ value }) => {
      if (isPending) return;

      // Validar data no futuro
      const scheduledDate = new Date(value.scheduledAt);
      const now = new Date();
      if (scheduledDate <= now) {
        toast.error("A data de agendamento deve ser no futuro");
        return;
      }

      // Validar conteúdo
      if (!value.content.trim()) {
        toast.error("Conteúdo é obrigatório");
        return;
      }

      startTransition(async () => {
        try {
          // Se editingItem existe, é uma atualização; caso contrário, é criação
          if (editingItem) {
            const promise = update.mutateAsync({
              id: editingItem.scheduledMessage.id,
              content: value.content,
              scheduledAt: new Date(value.scheduledAt),
              cancelOnContactMessage: value.cancelOnContactMessage,
              cancelOnAgentMessage: value.cancelOnAgentMessage,
              cancelOnChatClose: value.cancelOnChatClose,
            });

            toast.promise(promise, {
              loading: "Salvando...",
              success: () => {
                onSuccess();
                return "Agendamento atualizado com sucesso!";
              },
              error: (error) => {
                if (isTRPCClientError(error)) {
                  return error.message;
                }
                return "Erro ao atualizar agendamento";
              },
            });

            await promise;
          } else {
            const promise = create.mutateAsync({
              chatId: chat.id,
              chatCreatedAt: chat.createdAt,
              contentType,
              content: value.content,
              scheduledAt: new Date(value.scheduledAt),
              timezone,
              cancelOnContactMessage: value.cancelOnContactMessage,
              cancelOnAgentMessage: value.cancelOnAgentMessage,
              cancelOnChatClose: value.cancelOnChatClose,
            });

            toast.promise(promise, {
              loading: "Agendando...",
              success: () => {
                onSuccess();
                return "Agendamento criado com sucesso!";
              },
              error: (error) => {
                if (isTRPCClientError(error)) {
                  return error.message;
                }
                return "Erro ao criar agendamento";
              },
            });

            await promise;
          }
        } catch {
          // Erro já tratado pelo toast.promise
        }
      });
    },
  });

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
      <form.Field name="scheduledAt">
        {(field) => (
          <div className="space-y-2">
            <Label htmlFor="scheduledAt">Data e Hora</Label>
            <input
              id="scheduledAt"
              type="datetime-local"
              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
            />
          </div>
        )}
      </form.Field>

      {/* Conteúdo */}
      <form.Field name="content">
        {(field) => (
          <div className="space-y-2">
            <Label htmlFor="content">
              {contentType === "message" ? "Mensagem" : "Nota"}
            </Label>
            <Textarea
              id="content"
              placeholder={
                contentType === "message"
                  ? "Digite sua mensagem..."
                  : "Digite sua nota interna..."
              }
              className="min-h-[100px] resize-none"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
            />
          </div>
        )}
      </form.Field>

      {/* Opções de cancelamento automático - apenas para mensagens */}
      {contentType === "message" && (
        <div className="space-y-3 rounded-lg border p-4">
          <Label className="text-sm font-medium">
            Cancelar automaticamente se:
          </Label>

          <form.Field name="cancelOnContactMessage">
            {(field) => (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="cancelOnContactMessage"
                  checked={field.state.value}
                  onCheckedChange={(checked) =>
                    field.handleChange(checked === true)
                  }
                />
                <Label
                  htmlFor="cancelOnContactMessage"
                  className="cursor-pointer text-sm leading-none font-normal peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
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
                  onCheckedChange={(checked) =>
                    field.handleChange(checked === true)
                  }
                />
                <Label
                  htmlFor="cancelOnAgentMessage"
                  className="cursor-pointer text-sm leading-none font-normal peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
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
                  onCheckedChange={(checked) =>
                    field.handleChange(checked === true)
                  }
                />
                <Label
                  htmlFor="cancelOnChatClose"
                  className="cursor-pointer text-sm leading-none font-normal peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Conversa for finalizada
                </Label>
              </div>
            )}
          </form.Field>
        </div>
      )}

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
            ? editingItem
              ? "Salvando..."
              : "Agendando..."
            : editingItem
              ? "Salvar alterações"
              : "Agendar"}
        </Button>
      </div>
    </form>
  );
}
