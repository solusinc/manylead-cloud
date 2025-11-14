"use client";

import type { ColumnFiltersState, SortingState } from "@tanstack/react-table";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "~/components/content/section";
import { columns } from "~/components/data-table/departments/columns";
import { DepartmentDataTableActionBar } from "~/components/data-table/departments/data-table-action-bar";
import { DepartmentDataTableToolbar } from "~/components/data-table/departments/data-table-toolbar";
import { DataTable } from "~/components/ui/data-table/data-table";
import { DataTablePaginationSimple } from "~/components/ui/data-table/data-table-pagination";
import { DataTableSkeleton } from "~/components/ui/data-table/data-table-skeleton";
import { useTRPC } from "~/lib/trpc/react";

export function Client() {
  const trpc = useTRPC();
  const { data: departments, isLoading } = useQuery(
    trpc.departments.list.queryOptions(),
  );
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>Departamentos</SectionTitle>
          <SectionDescription>
            Departamentos são usados para organizar usuários, direcionar o
            chatbot e facilitar transferências.
          </SectionDescription>
        </SectionHeader>
      </Section>
      <Section>
        {isLoading ? (
          <DataTableSkeleton rows={5} />
        ) : departments ? (
          <DataTable
            columns={columns}
            data={departments}
            actionBar={DepartmentDataTableActionBar}
            toolbarComponent={DepartmentDataTableToolbar}
            paginationComponent={DataTablePaginationSimple}
            columnFilters={columnFilters}
            setColumnFilters={setColumnFilters}
            sorting={sorting}
            setSorting={setSorting}
            defaultColumnVisibility={{
              description: false,
              createdAt: false,
            }}
          />
        ) : null}
      </Section>
    </SectionGroup>
  );
}
