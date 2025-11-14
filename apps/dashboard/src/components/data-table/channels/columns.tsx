"use client";

import { Checkbox } from "@manylead/ui/checkbox";
import { Badge } from "@manylead/ui/badge";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "~/components/ui/data-table/data-table-column-header";
import type { Channel } from "@manylead/db";
import { DataTableRowActions } from "./data-table-row-actions";
import { TableCellDate } from "~/components/data-table/table-cell-date";
import { usePermissions } from "~/lib/permissions";

type ChannelRow = Omit<Channel, "authState" | "sessionData">;

function ChannelNameCell({ channelId, name }: { channelId: string; name: string }) {
  const { can } = usePermissions();

  if (can("manage", "Channel")) {
    return (
      <a
        href={`/settings/channels/${channelId}/edit`}
        className="font-medium hover:underline"
      >
        {name || "Sem nome"}
      </a>
    );
  }

  return <span className="font-medium">{name || "Sem nome"}</span>;
}

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  connected: "default",
  disconnected: "outline",
  error: "destructive",
  rate_limited: "destructive",
};

export const columns: ColumnDef<ChannelRow>[] = [
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
    accessorKey: "displayName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Nome" />
    ),
    cell: ({ row }) => {
      return (
        <ChannelNameCell
          channelId={row.original.id}
          name={row.getValue("displayName")}
        />
      );
    },
    enableHiding: false,
    meta: {
      cellClassName: "max-w-[200px] min-w-max",
    },
  },
  {
    accessorKey: "phoneNumber",
    header: "Telefone",
    cell: ({ row }) => {
      const phoneNumber = row.getValue("phoneNumber");
      return (
        <span className="font-mono text-sm">
          {(phoneNumber as string | null) ?? "—"}
        </span>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status");
      return (
        <Badge variant={STATUS_VARIANTS[status as string] ?? "secondary"}>
          {status as string}
        </Badge>
      );
    },
    filterFn: (row, _, value) => {
      if (Array.isArray(value)) {
        return value.includes(row.original.status);
      }
      return row.original.status === value;
    },
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Criado" />
    ),
    cell: ({ row }) => {
      return <TableCellDate value={row.getValue("createdAt")} />;
    },
    enableSorting: true,
  },
  {
    id: "actions",
    cell: ({ row }) => <DataTableRowActions row={row} />,
    enableHiding: false,
  },
];
