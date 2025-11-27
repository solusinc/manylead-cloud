"use client";

import { Checkbox } from "@manylead/ui/checkbox";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "~/components/ui/data-table/data-table-column-header";
import type { Ending } from "@manylead/db";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DataTableRowActions } from "./data-table-row-actions";
import { TableCellDate } from "~/components/data-table/table-cell-date";
import { usePermissions } from "~/lib/permissions";

function EndingTitleCell({ endingId, title }: { endingId: string; title: string }) {
  const { can } = usePermissions();

  if (can("manage", "Ending")) {
    return (
      <a
        href={`/settings/endings/${endingId}/edit`}
        className="font-medium hover:underline"
      >
        {title}
      </a>
    );
  }

  return <span className="font-medium">{title}</span>;
}

function RatingBehaviorCell({ ratingBehavior }: { ratingBehavior: string }) {
  const labels: Record<string, string> = {
    default: "Padrão da instância",
    enabled: "Ativado",
    disabled: "Desativado",
  };

  return (
    <span className="text-muted-foreground text-sm">
      {labels[ratingBehavior] ?? ratingBehavior}
    </span>
  );
}

export const columns: ColumnDef<Ending>[] = [
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
        <EndingTitleCell
          endingId={row.original.id}
          title={row.getValue("title")}
        />
      );
    },
    enableHiding: false,
    meta: {
      cellClassName: "max-w-[200px] min-w-max",
    },
  },
  {
    accessorKey: "ratingBehavior",
    header: "Avaliação",
    cell: ({ row }) => {
      return <RatingBehaviorCell ratingBehavior={row.getValue("ratingBehavior")} />;
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
