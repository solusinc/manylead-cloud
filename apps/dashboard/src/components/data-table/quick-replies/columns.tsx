"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Globe, Lock } from "lucide-react";

import type { QuickReply } from "@manylead/db";
import { Badge } from "@manylead/ui/badge";
import { Checkbox } from "@manylead/ui/checkbox";

import { DataTableColumnHeader } from "~/components/ui/data-table/data-table-column-header";
import { TableCellDate } from "~/components/data-table/table-cell-date";
import { DataTableRowActions } from "./data-table-row-actions";

function QuickReplyTitleCell({
  id,
  title,
  shortcut,
}: {
  id: string;
  title: string;
  shortcut: string;
}) {
  return (
    <a
      href={`/settings/quick-replies/${id}`}
      className="flex flex-col gap-0.5 hover:underline"
    >
      <span className="font-medium">{title}</span>
      <span className="font-mono text-xs text-muted-foreground">{shortcut}</span>
    </a>
  );
}

function VisibilityCell({ visibility }: { visibility: string }) {
  const isPublic = visibility === "organization";

  return (
    <Badge variant={isPublic ? "secondary" : "outline"} className="gap-1">
      {isPublic ? (
        <>
          <Globe className="h-3 w-3" />
          Para todos
        </>
      ) : (
        <>
          <Lock className="h-3 w-3" />
          Privada
        </>
      )}
    </Badge>
  );
}

function ContentPreviewCell({ content }: { content: string }) {
  const truncated = content.length > 50 ? `${content.slice(0, 50)}...` : content;
  return (
    <span className="text-sm text-muted-foreground line-clamp-2">
      {truncated}
    </span>
  );
}

export const columns: ColumnDef<QuickReply>[] = [
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
    accessorKey: "title",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Título" />
    ),
    cell: ({ row }) => {
      return (
        <QuickReplyTitleCell
          id={row.original.id}
          title={row.getValue("title")}
          shortcut={row.original.shortcut}
        />
      );
    },
    enableHiding: false,
    meta: {
      cellClassName: "min-w-[200px]",
    },
  },
  {
    accessorKey: "content",
    header: "Conteúdo",
    cell: ({ row }) => {
      return <ContentPreviewCell content={row.getValue("content")} />;
    },
    enableSorting: false,
    meta: {
      cellClassName: "max-w-[300px]",
    },
  },
  {
    accessorKey: "visibility",
    header: "Visibilidade",
    cell: ({ row }) => {
      return <VisibilityCell visibility={row.getValue("visibility")} />;
    },
    enableSorting: false,
    filterFn: (row, id, value: string[]) => {
      const cellValue = row.getValue<string>(id);
      return value.includes(cellValue);
    },
  },
  {
    accessorKey: "usageCount",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Usos" />
    ),
    cell: ({ row }) => {
      const count = row.getValue<number>("usageCount");
      return <span className="text-sm text-muted-foreground">{count}</span>;
    },
    enableSorting: true,
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Criado" />
    ),
    cell: ({ row }) => {
      const value = row.getValue("createdAt");
      if (value instanceof Date) {
        return (
          <TableCellDate
            value={formatDistanceToNow(value, { addSuffix: true, locale: ptBR })}
            className="text-sm"
          />
        );
      }
      return <TableCellDate value={value} className="text-sm" />;
    },
    enableSorting: true,
    enableHiding: true,
  },
  {
    id: "actions",
    cell: ({ row }) => <DataTableRowActions row={row} />,
    enableHiding: false,
  },
];
