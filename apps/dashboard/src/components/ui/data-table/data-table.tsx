"use client";

import type {
  ColumnDef,
  ColumnFiltersState,
  PaginationState,
  Row,
  SortingState,
  VisibilityState,
} from "@tanstack/react-table";
import * as React from "react";
import { Fragment } from "react";
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@manylead/ui/table";

import type { DataTableActionBarProps } from "./data-table-action-bar";
import type { DataTablePaginationProps } from "./data-table-pagination";
import type { DataTableToolbarProps } from "./data-table-toolbar";

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  rowComponent?: React.ComponentType<{ row: Row<TData> }>;
  toolbarComponent?: React.ComponentType<DataTableToolbarProps<TData>>;
  actionBar?: React.ComponentType<DataTableActionBarProps<TData>>;
  paginationComponent?: React.ComponentType<DataTablePaginationProps<TData>>;
  onRowClick?: (row: Row<TData>) => void;
  defaultSorting?: SortingState;
  defaultColumnVisibility?: VisibilityState;
  defaultColumnFilters?: ColumnFiltersState;
  defaultPagination?: PaginationState;
  autoResetPageIndex?: boolean;

  /** access the state from the parent component */
  columnFilters?: ColumnFiltersState;
  setColumnFilters?: React.Dispatch<React.SetStateAction<ColumnFiltersState>>;
  sorting?: SortingState;
  setSorting?: React.Dispatch<React.SetStateAction<SortingState>>;
  pagination?: PaginationState;
  setPagination?: React.Dispatch<React.SetStateAction<PaginationState>>;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  rowComponent,
  toolbarComponent,
  actionBar,
  paginationComponent,
  onRowClick,
  defaultSorting = [],
  defaultColumnVisibility = {},
  defaultColumnFilters = [],
  defaultPagination = { pageIndex: 0, pageSize: 20 },
  autoResetPageIndex = true,
  columnFilters,
  setColumnFilters,
  sorting,
  setSorting,
  pagination,
  setPagination,
}: DataTableProps<TData, TValue>) {
  const [globalFilter, setGlobalFilter] = React.useState<string>("");
  const [rowSelection, setRowSelection] = React.useState<
    Record<string, boolean>
  >({});
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>(defaultColumnVisibility);
  const [internalPagination, setInternalPagination] =
    React.useState<PaginationState>(defaultPagination);
  const [internalColumnFilters, setInternalColumnFilters] =
    React.useState<ColumnFiltersState>(defaultColumnFilters);
  const [internalSorting, setInternalSorting] =
    React.useState<SortingState>(defaultSorting);

  // Use controlled or uncontrolled column filters
  const columnFiltersState = columnFilters ?? internalColumnFilters;
  const setColumnFiltersState = setColumnFilters ?? setInternalColumnFilters;
  const sortingState = sorting ?? internalSorting;
  const setSortingState = setSorting ?? setInternalSorting;
  const paginationState = pagination ?? internalPagination;
  const setPaginationState = setPagination ?? setInternalPagination;

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting: sortingState,
      columnVisibility,
      rowSelection,
      pagination: paginationState,
      columnFilters: columnFiltersState,
      globalFilter,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSortingState,
    onColumnFiltersChange: setColumnFiltersState,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPaginationState,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getExpandedRowModel: getExpandedRowModel(),
    autoResetPageIndex,
    // @ts-expect-error as we have an id in the data
    getRowCanExpand: (row) => Boolean(row.original.id),
  });

  return (
    <div className="grid gap-2">
      {toolbarComponent
        ? React.createElement(toolbarComponent, { table })
        : null}
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                return (
                  <TableHead
                    key={header.id}
                    colSpan={header.colSpan}
                    className={header.column.columnDef.meta?.headerClassName}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <Fragment key={row.id}>
                <TableRow
                  data-state={
                    (row.getIsSelected() || row.getIsExpanded()) && "selected"
                  }
                  onClick={() => onRowClick?.(row)}
                  className="data-[state=selected]:bg-muted/50"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cell.column.columnDef.meta?.cellClassName}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
                {row.getIsExpanded() && (
                  <TableRow className="hover:bg-background">
                    <TableCell
                      className="p-0"
                      colSpan={row.getVisibleCells().length}
                    >
                      {rowComponent
                        ? React.createElement(rowComponent, { row })
                        : null}
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                Nenhum resultado.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
        {actionBar ? React.createElement(actionBar, { table }) : null}
      </Table>
      {paginationComponent
        ? React.createElement(paginationComponent, { table })
        : null}
    </div>
  );
}
