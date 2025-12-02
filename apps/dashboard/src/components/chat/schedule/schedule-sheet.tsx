"use client";

import { useState } from "react";
import { ArrowLeft, Plus } from "lucide-react";

import type { ScheduledMessage } from "@manylead/db";
import { Button } from "@manylead/ui/button";
import { ScrollArea } from "@manylead/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@manylead/ui/sheet";

import { useChatSocketContext } from "~/components/providers/chat-socket-provider";
import { useChat } from "../providers/chat-context";
import { ScheduleForm } from "./schedule-form";
import { ScheduleList } from "./schedule-list";
import { useScheduledMessageSocket } from "./hooks/use-scheduled-message-socket";

interface ScheduleSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ViewMode = "list" | "create" | "edit";

interface ScheduledMessageItem {
  scheduledMessage: ScheduledMessage;
  createdByAgent: unknown;
}

export function ScheduleSheet({ open, onOpenChange }: ScheduleSheetProps) {
  const socket = useChatSocketContext();
  const { chat } = useChat();
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [editingItem, setEditingItem] = useState<ScheduledMessageItem | null>(
    null,
  );

  // Escutar eventos de socket para atualizar a lista quando uma mensagem agendada é enviada
  useScheduledMessageSocket(socket, chat.id);

  const handleCreate = () => {
    setEditingItem(null);
    setViewMode("create");
  };

  const handleEdit = (item: ScheduledMessageItem) => {
    setEditingItem(item);
    setViewMode("edit");
  };

  const handleCancel = () => {
    setEditingItem(null);
    setViewMode("list");
  };

  const handleSuccess = () => {
    setEditingItem(null);
    setViewMode("list");
  };

  const handleOpenChange = (newOpen: boolean) => {
    // Reset to list view when closing
    if (!newOpen) {
      setViewMode("list");
      setEditingItem(null);
    }
    onOpenChange(newOpen);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="flex w-full flex-col gap-2 sm:max-w-md">
        <SheetHeader className="p-4">
          <div className="flex items-center gap-2">
            {viewMode !== "list" && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCancel}
                className="size-8"
              >
                <ArrowLeft className="size-4" />
              </Button>
            )}
            <SheetTitle>
              {viewMode === "list" && "Agendamentos"}
              {viewMode === "create" && "Novo Agendamento"}
              {viewMode === "edit" && "Editar Agendamento"}
            </SheetTitle>
          </div>
        </SheetHeader>

        {viewMode === "list" && (
          <div className="px-4 pb-4">
            <Button onClick={handleCreate} className="w-1/2">
              <Plus className="mr-2 size-4" />
              Novo Agendamento
            </Button>
          </div>
        )}

        <ScrollArea className="flex-1 px-4">
          {viewMode === "list" && <ScheduleList onEdit={handleEdit} />}
          {(viewMode === "create" || viewMode === "edit") && (
            <ScheduleForm
              onCancel={handleCancel}
              onSuccess={handleSuccess}
              editingItem={editingItem}
            />
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
