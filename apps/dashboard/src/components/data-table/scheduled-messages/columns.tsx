"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageSquare, StickyNote } from "lucide-react";

import { Badge } from "@manylead/ui/badge";

import { DataTableColumnHeader } from "~/components/ui/data-table/data-table-column-header";

interface ScheduledMessageRow {
  scheduledMessage: {
    id: string;
    contentType: string;
    content: string;
    status: string;
    scheduledAt: Date;
  };
  createdByAgent: {
    id: string;
  } | null;
  chat: {
    id: string;
  } | null;
  contact: {
    id: string;
    name: string | null;
  } | null;
}

export const columns: ColumnDef<ScheduledMessageRow>[] = [
  {
    id: "type",
    header: "Tipo",
    cell: ({ row }) => {
      const isMessage = row.original.scheduledMessage.contentType === "message";
      return (
        <div className="flex items-center gap-2">
          {isMessage ? (
            <>
              <MessageSquare className="h-4 w-4 text-blue-500" />
              <span className="text-sm">Mensagem</span>
            </>
          ) : (
            <>
              <StickyNote className="h-4 w-4 text-amber-500" />
              <span className="text-sm">Nota</span>
            </>
          )}
        </div>
      );
    },
    enableSorting: false,
  },
  {
    accessorKey: "scheduledAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Agendado para" />
    ),
    cell: ({ row }) => {
      const date = new Date(row.original.scheduledMessage.scheduledAt);
      return (
        <div className="flex flex-col">
          <span className="font-medium">
            {format(date, "dd/MM/yyyy", { locale: ptBR })}
          </span>
          <span className="text-sm text-muted-foreground">
            {format(date, "HH:mm", { locale: ptBR })}
          </span>
        </div>
      );
    },
    enableSorting: true,
  },
  {
    id: "chat",
    header: "Chat / Contato",
    cell: ({ row }) => {
      const contact = row.original.contact;
      const chat = row.original.chat;

      if (!contact && !chat) {
        return <span className="text-muted-foreground">N/A</span>;
      }

      return (
        <div className="max-w-[200px] truncate">
          {contact?.name ?? "Sem nome"}
        </div>
      );
    },
    enableSorting: false,
  },
  {
    id: "content",
    header: "Prévia do Conteúdo",
    cell: ({ row }) => {
      const content = row.original.scheduledMessage.content;
      return (
        <div className="max-w-[300px] truncate text-sm" title={content}>
          {content}
        </div>
      );
    },
    enableSorting: false,
  },
  {
    id: "createdBy",
    header: "Criado por",
    cell: () => {
      // Agent não tem campo name, precisa vir do user
      return <div className="text-sm">Agente</div>;
    },
    enableSorting: false,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.original.scheduledMessage.status;

      const statusConfig: Record<
        string,
        {
          label: string;
          variant: "default" | "secondary" | "destructive" | "outline";
        }
      > = {
        pending: { label: "Pendente", variant: "default" },
        processing: { label: "Processando", variant: "secondary" },
        sent: { label: "Enviado", variant: "outline" },
        failed: { label: "Falhou", variant: "destructive" },
        cancelled: { label: "Cancelado", variant: "outline" },
      };

      const config = statusConfig[status] ?? statusConfig.pending;

      if (!config) {
        return <Badge>Desconhecido</Badge>;
      }

      return <Badge variant={config.variant}>{config.label}</Badge>;
    },
    filterFn: (row, _, value: string[]) => {
      return value.includes(row.original.scheduledMessage.status);
    },
    enableSorting: true,
  },
];
