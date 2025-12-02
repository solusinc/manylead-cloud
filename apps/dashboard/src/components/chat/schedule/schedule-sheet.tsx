"use client";

import { useState } from "react";
import { CheckCircle2, Clock, Plus } from "lucide-react";

import type { ScheduledMessage } from "@manylead/db";
import { Badge } from "@manylead/ui/badge";
import { ScrollArea } from "@manylead/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@manylead/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@manylead/ui/tabs";

import { useChatSocketContext } from "~/components/providers/chat-socket-provider";
import { useChat } from "../providers/chat-context";
import { useScheduledMessagesStats } from "./hooks";
import { useScheduledMessageSocket } from "./hooks/use-scheduled-message-socket";
import { ScheduleForm } from "./schedule-form";
import { ScheduleList } from "./schedule-list";
import { ScheduleTypeSelector } from "./schedule-type-selector";

interface ScheduleSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ScheduledMessageItem {
  scheduledMessage: ScheduledMessage;
  createdByAgent: unknown;
}

export function ScheduleSheet({ open, onOpenChange }: ScheduleSheetProps) {
  const socket = useChatSocketContext();
  const { chat } = useChat();

  // States para controlar navegação
  const [activeTab, setActiveTab] = useState<"schedule" | "scheduled" | "completed">("schedule");
  const [scheduleView, setScheduleView] = useState<"selector" | "form">("selector");
  const [selectedContentType, setSelectedContentType] = useState<"message" | "comment" | null>(null);
  const [editingItem, setEditingItem] = useState<ScheduledMessageItem | null>(null);

  // Buscar estatísticas para badges
  const { data: stats } = useScheduledMessagesStats(chat.id, chat.createdAt);

  // Escutar eventos de socket para atualizar a lista quando uma mensagem agendada é enviada
  useScheduledMessageSocket(socket, chat.id);

  const handleTypeSelect = (type: "message" | "comment") => {
    setSelectedContentType(type);
    setScheduleView("form");
  };

  const handleBackToSelector = () => {
    setScheduleView("selector");
    setSelectedContentType(null);
    setEditingItem(null);
  };

  const handleSuccess = () => {
    setScheduleView("selector");
    setSelectedContentType(null);
    setEditingItem(null);
    setActiveTab("scheduled"); // Navegar para tab "Agendadas"
  };

  const handleEdit = (item: ScheduledMessageItem) => {
    setEditingItem(item);
    setSelectedContentType(item.scheduledMessage.contentType);
    setScheduleView("form");
    setActiveTab("schedule");
  };

  const handleOpenChange = (newOpen: boolean) => {
    // Reset states when closing
    if (!newOpen) {
      setActiveTab("schedule");
      setScheduleView("selector");
      setSelectedContentType(null);
      setEditingItem(null);
    }
    onOpenChange(newOpen);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b p-4">
          <SheetTitle>Agendamentos</SheetTitle>
        </SheetHeader>

        <Tabs
          value={activeTab}
          onValueChange={(value) =>
            setActiveTab(value as "schedule" | "scheduled" | "completed")
          }
          className="flex flex-1 flex-col"
        >
          <TabsList className="mx-4 mt-4 grid w-auto grid-cols-3">
            <TabsTrigger value="schedule" className="gap-2">
              <Plus className="h-4 w-4" />
              Agendar
            </TabsTrigger>
            <TabsTrigger value="scheduled">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>Agendadas</span>
                {stats && stats.pending > 0 && (
                  <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-xs">
                    {stats.pending}
                  </Badge>
                )}
              </div>
            </TabsTrigger>
            <TabsTrigger value="completed">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                <span>Concluídas</span>
                {stats && stats.sent > 0 && (
                  <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-xs">
                    {stats.sent}
                  </Badge>
                )}
              </div>
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1">
            <TabsContent value="schedule" className="mt-0">
              {scheduleView === "selector" ? (
                <ScheduleTypeSelector onSelect={handleTypeSelect} />
              ) : selectedContentType ? (
                <ScheduleForm
                  contentType={selectedContentType}
                  onCancel={handleBackToSelector}
                  onSuccess={handleSuccess}
                  editingItem={editingItem}
                />
              ) : null}
            </TabsContent>

            <TabsContent value="scheduled" className="mt-0">
              <ScheduleList status="pending" onEdit={handleEdit} />
            </TabsContent>

            <TabsContent value="completed" className="mt-0">
              <ScheduleList status="sent" />
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
