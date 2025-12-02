"use client";

import { Badge, Checkbox } from "@manylead/ui";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "~/components/ui/data-table/data-table-column-header";
import type { Department } from "@manylead/db";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DataTableRowActions } from "./data-table-row-actions";
import { TableCellDate } from "~/components/data-table/table-cell-date";
import { usePermissions } from "~/lib/permissions";

function DepartmentNameCell({ departmentId, name, isDefault }: { departmentId: string; name: string; isDefault: boolean }) {
  const { can } = usePermissions();

  if (can("manage", "Department")) {
    return (
      <div className="flex items-center gap-2">
        <a
          href={`/settings/departments/${departmentId}/edit`}
          className="font-medium hover:underline"
        >
          {name}
        </a>
        {isDefault && (
          <Badge variant="secondary" className="text-xs">
            Padrão
          </Badge>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="font-medium">{name}</span>
      {isDefault && (
        <Badge variant="secondary" className="text-xs">
          Padrão
        </Badge>
      )}
    </div>
  );
}

export const columns: ColumnDef<Department>[] = [
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
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Nome" />
    ),
    cell: ({ row }) => {
      return (
        <DepartmentNameCell
          departmentId={row.original.id}
          name={row.getValue("name")}
          isDefault={row.original.isDefault}
        />
      );
    },
    enableHiding: false,
    meta: {
      cellClassName: "max-w-[150px] min-w-max",
    },
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
