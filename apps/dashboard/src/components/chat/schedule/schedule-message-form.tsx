"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@manylead/ui/tabs";

import type { ScheduledMessage } from "@manylead/db";
import { ScheduleForm } from "./schedule-form";
import { ScheduleQuickReplyForm } from "./schedule-quick-reply-form";

interface ScheduleMessageFormProps {
  onCancel: () => void;
  onSuccess: () => void;
  editingItem?: {
    scheduledMessage: ScheduledMessage;
    createdByAgent: unknown;
  } | null;
}

export function ScheduleMessageForm({
  onCancel,
  onSuccess,
  editingItem,
}: ScheduleMessageFormProps) {
  // Se estiver editando, determinar qual tab mostrar baseado em quickReplyId
  const isEditingQuickReply = !!editingItem?.scheduledMessage.quickReplyId;
  const [activeTab, setActiveTab] = useState<string>(
    isEditingQuickReply ? "quick-reply" : "manual"
  );

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="mx-4 mt-4 grid w-auto grid-cols-2">
        <TabsTrigger value="manual">Manual</TabsTrigger>
        <TabsTrigger value="quick-reply">Resposta Rápida</TabsTrigger>
      </TabsList>

      <TabsContent value="manual" className="mt-0">
        <ScheduleForm
          contentType="message"
          onCancel={onCancel}
          onSuccess={onSuccess}
          editingItem={editingItem}
        />
      </TabsContent>

      <TabsContent value="quick-reply" className="mt-0">
        <ScheduleQuickReplyForm
          onCancel={onCancel}
          onSuccess={onSuccess}
          editingItem={editingItem}
        />
      </TabsContent>
    </Tabs>
  );
}
