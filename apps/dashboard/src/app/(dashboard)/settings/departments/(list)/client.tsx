"use client";

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
import { DataTableSkeleton } from "~/components/ui/data-table/data-table-skeleton";
import { DataTablePaginationSimple } from "~/components/ui/data-table/data-table-pagination";
import { useTRPC } from "~/lib/trpc/react";
import { useQuery } from "@tanstack/react-query";
import type { ColumnFiltersState, SortingState } from "@tanstack/react-table";
import { useState } from "react";

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
            Organize sua equipe em setores e otimize a distribuição de
            conversas.
          </SectionDescription>
        </SectionHeader>
      </Section>
      <Section>
        {isLoading ? (
          <DataTableSkeleton rows={5} />
        ) : departments ? (
          <DataTable
            columns={columns}
            data={departments.map((dept) => ({
              ...dept,
              workingHours: dept.workingHours ?? undefined,
            }))}
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
