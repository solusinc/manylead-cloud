"use client";

import type * as React from "react";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import { addHours, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, FileText, Image, MessageSquare, Music, Pencil, StickyNote, Trash2, Zap } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Input } from "@manylead/ui/input";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@manylead/ui/select";

import type { QuickReplyMessageInput } from "@manylead/db";

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
  const [_isPending, startTransition] = useTransition();
  const [selectedQuickReplyId, setSelectedQuickReplyId] = useState<string>("");
  const [confirmValue, setConfirmValue] = useState("");

  // Buscar nome da organização para substituição de variáveis
  const { data: currentOrganization } = useQuery(
    trpc.organization.getCurrent.queryOptions(),
  );

  // Verificar se está editando quick reply
  const isEditingQuickReply = !!editingItem?.scheduledMessage.quickReplyId;

  // Buscar quick replies completas para preview das mensagens da lista
  const quickReplyIdsInList = [
    ...new Set(
      messages
        .map((m) => m.scheduledMessage.quickReplyId)
        .filter((id): id is string => id != null)
    ),
  ];

  // Buscar todas as quick replies (será usado tanto para o form quanto para preview)
  const { data: allQuickReplies = [] } = useQuery({
    ...trpc.quickReplies.listAvailableForScheduling.queryOptions(),
    enabled: quickReplyIdsInList.length > 0 || isEditingQuickReply,
  });

  // Criar Map para lookup rápido das quick replies na lista
  const quickRepliesDataMap = new Map(
    allQuickReplies
      .filter((qr) => quickReplyIdsInList.includes(qr.id))
      .map((qr) => [qr.id, qr])
  );

  // Função para substituir variáveis no conteúdo
  const replaceVariables = (
    content: string,
    contactName: string | null,
    agentName: string | null,
  ) => {
    const organizationName = currentOrganization?.name ?? "";

    return content
      .replace(/\{\{contact\.name\}\}/g, contactName ?? "")
      .replace(/\{\{agent\.name\}\}/g, agentName ?? "")
      .replace(/\{\{organization\.name\}\}/g, organizationName);
  };

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

  const handleDeleteConfirm = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!deleteId || !onDelete) return;

    setIsDeleting(true);
    try {
      await onDelete(deleteId);
      setDeleteId(null);
      setConfirmValue("");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEdit = (item: ScheduledMessageItem) => {
    setEditingItem(item);
    if (item.scheduledMessage.quickReplyId) {
      setSelectedQuickReplyId(item.scheduledMessage.quickReplyId);
    }
  };

  const handleCancelEdit = () => {
    setEditingItem(null);
    setSelectedQuickReplyId("");
  };

  // Form para edição - sempre inicializa mas só usa quando editingItem existe
  const schedule = editingItem?.scheduledMessage;
  const form = useForm({
    defaultValues: {
      content: schedule?.content ?? "",
      quickReplyId: schedule?.quickReplyId ?? "",
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

      if (isEditingQuickReply) {
        // Validar quick reply selecionada
        if (!selectedQuickReplyId) {
          toast.error("Selecione uma resposta rápida");
          return;
        }

        const selectedQuickReply = allQuickReplies.find(
          (qr) => qr.id === selectedQuickReplyId,
        );

        if (!selectedQuickReply) {
          toast.error("Resposta rápida não encontrada");
          return;
        }

        startTransition(async () => {
          try {
            await updateMutation.mutateAsync({
              id: editingItem.scheduledMessage.id,
              quickReplyId: selectedQuickReplyId,
              scheduledAt: scheduledDate,
              cancelOnContactMessage: value.cancelOnContactMessage,
              cancelOnAgentMessage: value.cancelOnAgentMessage,
              cancelOnChatClose: value.cancelOnChatClose,
            });
          } catch (error) {
            console.error("Erro ao atualizar quick reply:", error);
          }
        });
      } else {
        // Validar conteúdo
        if (!value.content.trim()) {
          toast.error("Conteúdo é obrigatório");
          return;
        }

        await updateMutation.mutateAsync({
          id: editingItem.scheduledMessage.id,
          content: value.content,
          scheduledAt: scheduledDate,
          cancelOnContactMessage: value.cancelOnContactMessage,
          cancelOnAgentMessage: value.cancelOnAgentMessage,
          cancelOnChatClose: value.cancelOnChatClose,
        });
      }
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
    ? isEditingQuickReply
      ? "Editar Resposta Rápida"
      : `Editar ${isMessage ? "Mensagem" : "Nota"}`
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

              {/* Seletor de Quick Reply - apenas se for quick reply */}
              {isEditingQuickReply && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="quickReplyId">Resposta Rápida *</Label>
                    <Select
                      value={selectedQuickReplyId}
                      onValueChange={setSelectedQuickReplyId}
                      disabled={false}
                    >
                      <SelectTrigger id="quickReplyId">
                        <SelectValue placeholder="Selecione uma resposta rápida" />
                      </SelectTrigger>
                      <SelectContent>
                        {allQuickReplies.map((qr) => (
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
                  </div>

                  {/* Preview da Quick Reply */}
                  {(() => {
                    const selectedQuickReply = selectedQuickReplyId
                      ? allQuickReplies.find((qr) => qr.id === selectedQuickReplyId)
                      : undefined;

                    if (!selectedQuickReply) return null;

                    return (
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

                            const contactName = editingItem.contact?.name ?? null;
                            const agentName = editingItem.createdByUser?.name ?? null;
                            const previewContent = hasMedia && msg.content
                              ? replaceVariables(msg.content, contactName, agentName)
                              : hasMedia
                                ? msg.mediaName ?? "[mídia]"
                                : msg.content
                                  ? replaceVariables(msg.content, contactName, agentName)
                                  : "[sem conteúdo]";

                            return (
                              <div
                                key={idx}
                                className="rounded border bg-background p-2 text-xs"
                              >
                                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                  <TypeIcon className="h-3 w-3" />
                                  <span>{typeLabel}</span>
                                </div>
                                <p className="mt-1 line-clamp-2">{previewContent}</p>
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
                    );
                  })()}
                </>
              )}

              {/* Conteúdo - apenas se NÃO for quick reply */}
              {!isEditingQuickReply && (
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
              )}

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
              <div className="space-y-3 p-4" tabIndex={0}>
              {messages.map((item) => {
                const schedule = item.scheduledMessage;
                const isQuickReply = !!schedule.quickReplyId;
                const contactName = item.contact?.name ?? null;
                const agentName = item.createdByUser?.name ?? null;

                return (
                  <div key={schedule.id} className="space-y-3 rounded-lg border bg-card p-4">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {isQuickReply ? (
                          <Zap className="h-4 w-4 text-primary" />
                        ) : isMessage ? (
                          <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <StickyNote className="h-4 w-4 text-muted-foreground" />
                        )}
                        <h3 className="text-sm font-medium">
                          {isQuickReply
                            ? schedule.quickReplyTitle ?? "Resposta Rápida"
                            : isMessage
                              ? "Mensagem"
                              : "Nota"}
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
                    {(() => {
                      const quickReplyData = isQuickReply && schedule.quickReplyId
                        ? quickRepliesDataMap.get(schedule.quickReplyId)
                        : undefined;

                      if (quickReplyData) {
                        return (
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-muted-foreground">
                              {quickReplyData.messages.length}{" "}
                              {quickReplyData.messages.length === 1 ? "mensagem" : "mensagens"}
                            </p>
                            {quickReplyData.messages.map((msg: QuickReplyMessageInput, idx: number) => {
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

                              const previewContent = hasMedia && msg.content
                                ? replaceVariables(msg.content, contactName, agentName)
                                : hasMedia
                                  ? msg.mediaName ?? "[mídia]"
                                  : msg.content
                                    ? replaceVariables(msg.content, contactName, agentName)
                                    : "[sem conteúdo]";

                              return (
                                <div
                                  key={idx}
                                  className="rounded-lg border border-border bg-muted p-3"
                                >
                                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                                    <TypeIcon className="h-3.5 w-3.5" />
                                    <span>{typeLabel}</span>
                                  </div>
                                  <p className="text-sm leading-relaxed">{previewContent}</p>
                                </div>
                              );
                            })}
                          </div>
                        );
                      }

                      return (
                        <div
                          className={`rounded-lg border p-4 ${
                            isMessage
                              ? "border-border bg-muted"
                              : "border-amber-300 bg-amber-50 dark:border-[#faad14] dark:bg-[#453316]"
                          }`}
                        >
                          <p className="text-sm leading-relaxed">
                            {schedule.content}
                          </p>
                        </div>
                      );
                    })()}

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
        <AlertDialogContent
          onCloseAutoFocus={() => {
            // NOTE: bug where the body is not clickable after closing the alert dialog
            document.body.style.pointerEvents = "";
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>
              Tem certeza que deseja deletar `este agendamento`?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Isto irá remover permanentemente o
              registro do banco de dados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <form id="form-alert-dialog" className="space-y-0.5">
            <p className="text-muted-foreground text-xs">
              Por favor escreva &apos;
              <span className="font-semibold">cancelar</span>
              &apos; para confirmar
            </p>
            <Input value={confirmValue} onChange={(e) => setConfirmValue(e.target.value)} />
          </form>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40"
              disabled={confirmValue !== "cancelar" || isDeleting}
              form="form-alert-dialog"
              type="submit"
              onClick={handleDeleteConfirm}
            >
              {isDeleting ? "Deletando..." : "Deletar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
