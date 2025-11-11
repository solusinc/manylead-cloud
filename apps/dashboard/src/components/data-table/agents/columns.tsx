"use client";

import { Checkbox } from "@manylead/ui/checkbox";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "~/components/ui/data-table/data-table-column-header";
import type { Agent } from "@manylead/db";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DataTableRowActions } from "./data-table-row-actions";
import { TableCellDate } from "~/components/data-table/table-cell-date";
import { Avatar, AvatarFallback, AvatarImage } from "@manylead/ui/avatar";

type AgentWithUser = Agent & {
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  } | null;
};

export const columns: ColumnDef<AgentWithUser>[] = [
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
    accessorKey: "user.name",
    id: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Nome" />
    ),
    cell: ({ row }) => {
      const user = row.original.user;
      if (!user) return <div className="text-muted-foreground">-</div>;

      return (
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.image ?? undefined} alt={user.name} />
            <AvatarFallback>
              {user.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <a
            href={`/settings/agents/${row.original.id}/edit`}
            className="font-medium hover:underline"
          >
            {user.name}
          </a>
        </div>
      );
    },
    enableHiding: false,
    meta: {
      cellClassName: "max-w-[200px] min-w-max",
    },
  },
  {
    accessorKey: "user.email",
    id: "email",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Email" />
    ),
    cell: ({ row }) => {
      const user = row.original.user;
      if (!user) return <div className="text-muted-foreground">-</div>;

      return (
        <div className="max-w-[250px] truncate text-muted-foreground">
          {user.email}
        </div>
      );
    },
    enableHiding: true,
  },
  {
    accessorKey: "role",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Cargo" />
    ),
    cell: ({ row }) => {
      const role = String(row.getValue("role"));
      const roleLabels: Record<string, string> = {
        owner: "Proprietário",
        admin: "Admin",
        member: "Membro",
      };
      return <div>{roleLabels[role] ?? role}</div>;
    },
    enableSorting: true,
    enableHiding: true,
  },
  {
    accessorKey: "isActive",
    header: "Status",
    cell: ({ row }) => {
      const value = row.getValue("isActive");
      return value ? (
        <div className="font-mono text-success">ativo</div>
      ) : (
        <div className="font-mono text-muted-foreground">inativo</div>
      );
    },
    filterFn: (row, _, value) => {
      if (Array.isArray(value)) {
        return value.includes(row.original.isActive ? "active" : "inactive");
      }
      return row.original.isActive === value;
    },
    enableSorting: true,
    enableHiding: false,
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
