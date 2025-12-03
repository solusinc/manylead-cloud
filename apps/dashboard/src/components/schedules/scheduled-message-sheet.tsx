"use client";

import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import { addHours, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, MessageSquare, Pencil, StickyNote, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@manylead/ui/alert-dialog";
import { Button } from "@manylead/ui/button";
import { Checkbox } from "@manylead/ui/checkbox";
import { Label } from "@manylead/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@manylead/ui/sheet";
import { Textarea } from "@manylead/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@manylead/ui/tooltip";
import { ScrollArea } from "@manylead/ui/scroll-area";

import { useTRPC } from "~/lib/trpc/react";
import type { ScheduledMessageItem } from "./calendar/types";

interface ScheduledMessageSheetProps {
  messages: ScheduledMessageItem[];
  date: Date | null;
  contentType: "message" | "comment" | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete?: (messageId: string) => Promise<void>;
  onUpdate?: () => void;
}

export function ScheduledMessageSheet({
  messages,
  date,
  contentType,
  open,
  onOpenChange,
  onDelete,
  onUpdate,
}: ScheduledMessageSheetProps) {
  const trpc = useTRPC();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingItem, setEditingItem] = useState<ScheduledMessageItem | null>(null);

  // Update mutation
  const updateMutation = useMutation(
    trpc.scheduledMessages.update.mutationOptions({
      onSuccess: () => {
        setEditingItem(null);
        onUpdate?.();
        toast.success("Agendamento atualizado com sucesso!");
      },
      onError: (error) => {
        if (isTRPCClientError(error)) {
          toast.error(error.message);
        } else {
          toast.error("Erro ao atualizar agendamento");
        }
      },
    }),
  );

  const handleDeleteConfirm = async () => {
    if (!deleteId || !onDelete) return;

    setIsDeleting(true);
    try {
      await onDelete(deleteId);
      setDeleteId(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEdit = (item: ScheduledMessageItem) => {
    setEditingItem(item);
  };

  const handleCancelEdit = () => {
    setEditingItem(null);
  };

  // Form para edição - sempre inicializa mas só usa quando editingItem existe
  const schedule = editingItem?.scheduledMessage;
  const form = useForm({
    defaultValues: {
      content: schedule?.content ?? "",
      scheduledAt: schedule
        ? format(new Date(schedule.scheduledAt), "yyyy-MM-dd'T'HH:mm")
        : format(addHours(new Date(), 1), "yyyy-MM-dd'T'HH:mm"),
      cancelOnContactMessage: schedule?.cancelOnContactMessage ?? false,
      cancelOnAgentMessage: schedule?.cancelOnAgentMessage ?? false,
      cancelOnChatClose: schedule?.cancelOnChatClose ?? false,
    },
    onSubmit: async ({ value }) => {
      if (!editingItem) return;

      // Validar data no futuro
      const scheduledDate = new Date(value.scheduledAt);
      if (scheduledDate <= new Date()) {
        toast.error("Data deve ser no futuro");
        return;
      }

      // Validar conteúdo
      if (!value.content.trim()) {
        toast.error("Conteúdo é obrigatório");
        return;
      }

      await updateMutation.mutateAsync({
        id: editingItem.scheduledMessage.id,
        content: value.content,
        scheduledAt: new Date(value.scheduledAt),
        cancelOnContactMessage: value.cancelOnContactMessage,
        cancelOnAgentMessage: value.cancelOnAgentMessage,
        cancelOnChatClose: value.cancelOnChatClose,
      });
    },
  });

  const formatDate = (d: Date) => {
    return format(d, "dd/MM/yyyy", { locale: ptBR });
  };

  if (!date || !contentType) return null;

  const isMessage = contentType === "message";
  const title = isMessage ? "Mensagens Agendadas" : "Notas Agendadas";
  const Icon = isMessage ? MessageSquare : StickyNote;

  // Se está editando, mostrar o título de edição
  const sheetTitle = editingItem
    ? `Editar ${isMessage ? "Mensagem" : "Nota"}`
    : title;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b p-4">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-muted-foreground" />
            <SheetTitle>{sheetTitle}</SheetTitle>
          </div>
          {!editingItem && (
            <p className="text-sm text-muted-foreground">
              {formatDate(date)} • {messages.length} {messages.length === 1 ? "agendamento" : "agendamentos"}
            </p>
          )}
        </SheetHeader>

        <div className="flex-1 flex flex-col overflow-hidden relative">
          {editingItem ? (
            // Formulário de edição
            <ScrollArea className="h-full w-full">
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
                  onClick={handleCancelEdit}
                  disabled={updateMutation.isPending}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar
                </Button>
                <Button type="submit" disabled={updateMutation.isPending} className="flex-1">
                  {updateMutation.isPending ? "Salvando..." : "Salvar alterações"}
                </Button>
              </div>
              </form>
            </ScrollArea>
          ) : (
            // Lista de mensagens
            <ScrollArea className="h-full w-full">
              <div className="space-y-3 p-4">
              {messages.map((item) => {
                const schedule = item.scheduledMessage;

                return (
                  <div key={schedule.id} className="space-y-3 rounded-lg border bg-card p-4">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {isMessage ? (
                          <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <StickyNote className="h-4 w-4 text-muted-foreground" />
                        )}
                        <h3 className="text-sm font-medium">
                          {isMessage ? "Mensagem" : "Nota"}
                        </h3>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9"
                              onClick={() => handleEdit(item)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Editar</p>
                          </TooltipContent>
                        </Tooltip>
                        {onDelete && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9"
                                onClick={() => setDeleteId(schedule.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Cancelar</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </div>

                    {/* Content box */}
                    <div
                      className={`rounded-lg border p-4 ${
                        isMessage
                          ? "border-border bg-muted"
                          : "border-amber-300 bg-amber-50 dark:border-[#faad14] dark:bg-[#453316]"
                      }`}
                    >
                      <p className="text-sm leading-relaxed">{schedule.content}</p>
                    </div>

                    {/* Opções de cancelamento automático */}
                    {(schedule.cancelOnContactMessage ??
                      schedule.cancelOnAgentMessage ??
                      schedule.cancelOnChatClose) && (
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <p className="font-medium">Cancelamento Automático:</p>
                        {schedule.cancelOnContactMessage && <p>• Cancelar se o contato enviar mensagem</p>}
                        {schedule.cancelOnAgentMessage && <p>• Cancelar se o atendente enviar mensagem</p>}
                        {schedule.cancelOnChatClose && <p>• Cancelar se o chat for finalizado</p>}
                      </div>
                    )}
                  </div>
                );
              })}
              </div>
            </ScrollArea>
          )}
        </div>
      </SheetContent>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar agendamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O agendamento será cancelado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? "Cancelando..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
