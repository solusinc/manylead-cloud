"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageSquare, StickyNote, Zap } from "lucide-react";

import { Badge } from "@manylead/ui/badge";
import { Checkbox } from "@manylead/ui/checkbox";

import { DataTableColumnHeader } from "~/components/ui/data-table/data-table-column-header";
import { DataTableRowActions } from "./data-table-row-actions";

interface ScheduledMessageRow {
  scheduledMessage: {
    id: string;
    contentType: string;
    content: string;
    status: string;
    scheduledAt: Date;
    quickReplyId?: string | null;
    quickReplyTitle?: string | null;
  };
  createdByAgent: {
    id: string;
  } | null;
  createdByUser: {
    id: string;
    name: string | null;
    email: string;
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
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Selecionar todos"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Selecionar linha"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    id: "contact",
    accessorFn: (row) => row.contact?.name ?? "",
    header: "Enviar para",
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
    id: "type",
    accessorFn: (row) => row.scheduledMessage.contentType,
    header: "Tipo",
    cell: ({ row }) => {
      const isMessage = row.original.scheduledMessage.contentType === "message";
      const isQuickReply = !!row.original.scheduledMessage.quickReplyId;
      const quickReplyTitle = row.original.scheduledMessage.quickReplyTitle;

      return (
        <div className="flex items-center gap-2">
          {isQuickReply ? (
            <>
              <Zap className="h-4 w-4 text-primary" />
              <span className="text-sm">
                {quickReplyTitle ?? "Resposta Rápida"}
              </span>
            </>
          ) : isMessage ? (
            <>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Mensagem</span>
            </>
          ) : (
            <>
              <StickyNote className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Nota</span>
            </>
          )}
        </div>
      );
    },
    filterFn: (row, _, value: string[]) => {
      return value.includes(row.original.scheduledMessage.contentType);
    },
    enableSorting: false,
  },
  {
    id: "scheduledAt",
    accessorFn: (row) => new Date(row.scheduledMessage.scheduledAt).getTime(),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Tempo para enviar" />
    ),
    cell: ({ row }) => {
      const date = new Date(row.original.scheduledMessage.scheduledAt);

      return (
        <div className="text-sm">
          {formatDistanceToNow(date, { addSuffix: true, locale: ptBR })}
        </div>
      );
    },
    enableSorting: true,
    sortingFn: "basic",
  },
  {
    id: "createdBy",
    accessorFn: (row) => row.createdByUser?.name ?? row.createdByUser?.email,
    header: "Agendado por",
    cell: ({ row }) => {
      const user = row.original.createdByUser;

      if (!user) {
        return <span className="text-muted-foreground">N/A</span>;
      }

      return (
        <div className="max-w-[150px] truncate">
          {user.name ?? user.email}
        </div>
      );
    },
    enableSorting: false,
  },
  {
    id: "status",
    accessorFn: (row) => row.scheduledMessage.status,
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
        expired: { label: "Expirado", variant: "outline" },
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
  {
    id: "actions",
    cell: ({ row }) => <DataTableRowActions row={row} />,
    enableHiding: false,
  },
];
