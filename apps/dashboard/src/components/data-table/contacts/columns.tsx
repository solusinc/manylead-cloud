"use client";

import { Checkbox } from "@manylead/ui/checkbox";
import type { ColumnDef } from "@tanstack/react-table";
import type { Contact } from "@manylead/db";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatBrazilianPhone } from "@manylead/shared/utils";

import { DataTableColumnHeader } from "~/components/ui/data-table/data-table-column-header";
import { TableCellDate } from "~/components/data-table/table-cell-date";
import { Badge } from "@manylead/ui/badge";

function SourceBadge({ source }: { source?: string }) {
  switch (source) {
    case "whatsapp":
      return (
        <Badge variant="outline" className="text-xs">
          WhatsApp
        </Badge>
      );
    case "manual":
      return (
        <Badge variant="outline" className="text-xs">
          Manual
        </Badge>
      );
    case "internal":
      return (
        <Badge variant="outline" className="text-xs">
          Interno
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-muted-foreground text-xs">
          -
        </Badge>
      );
  }
}

export const columns: ColumnDef<Contact>[] = [
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
        onClick={(e) => e.stopPropagation()}
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Nome" />
    ),
    cell: ({ row }) => {
      const name = row.original.name;
      const customName = row.original.customName;
      return (
        <div className="flex flex-col">
          <span className="cursor-pointer font-medium hover:underline">
            {customName ?? name}
          </span>
          {customName && (
            <span className="text-muted-foreground text-xs">{name}</span>
          )}
        </div>
      );
    },
    enableHiding: false,
    meta: {
      cellClassName: "max-w-[200px] min-w-max",
    },
  },
  {
    accessorKey: "phoneNumber",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Telefone" />
    ),
    cell: ({ row }) => {
      const phoneNumber = row.original.phoneNumber;
      if (!phoneNumber) {
        return <span className="text-muted-foreground">-</span>;
      }
      return (
        <span className="font-mono text-sm">
          {formatBrazilianPhone(phoneNumber)}
        </span>
      );
    },
    enableSorting: true,
    enableHiding: false,
  },
  {
    accessorKey: "email",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Email" />
    ),
    cell: ({ row }) => {
      const email = row.original.email;
      if (!email) {
        return <span className="text-muted-foreground">-</span>;
      }
      return <span className="text-sm">{email}</span>;
    },
    enableSorting: true,
    enableHiding: true,
  },
  {
    accessorKey: "metadata",
    header: "Origem",
    cell: ({ row }) => {
      const metadata = row.original.metadata;
      return <SourceBadge source={metadata?.source} />;
    },
    filterFn: (row, _, value) => {
      if (Array.isArray(value)) {
        return value.includes(row.original.metadata?.source);
      }
      return row.original.metadata?.source === value;
    },
    enableSorting: false,
    enableHiding: true,
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Criado" />
    ),
    cell: ({ row }) => {
      const value = row.original.createdAt;
      return (
        <TableCellDate
          value={formatDistanceToNow(value, { addSuffix: true, locale: ptBR })}
          className="text-sm"
        />
      );
    },
    enableSorting: true,
    enableHiding: true,
  },
];
