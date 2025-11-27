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
import { columns } from "~/components/data-table/endings/columns";
import { EndingDataTableActionBar } from "~/components/data-table/endings/data-table-action-bar";
import { EndingDataTableToolbar } from "~/components/data-table/endings/data-table-toolbar";
import { DataTable } from "~/components/ui/data-table/data-table";
import { DataTablePaginationSimple } from "~/components/ui/data-table/data-table-pagination";
import { DataTableSkeleton } from "~/components/ui/data-table/data-table-skeleton";
import { useTRPC } from "~/lib/trpc/react";

export function Client() {
  const trpc = useTRPC();
  const { data: endings, isLoading } = useQuery(
    trpc.endings.list.queryOptions(),
  );
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>Motivos de finalização</SectionTitle>
          <SectionDescription>
            Motivos de finalização permitem organizar e categorizar sessões
            finalizadas de forma eficiente.
          </SectionDescription>
        </SectionHeader>
      </Section>
      <Section>
        {isLoading ? (
          <DataTableSkeleton rows={5} />
        ) : endings ? (
          <DataTable
            columns={columns}
            data={endings}
            actionBar={EndingDataTableActionBar}
            toolbarComponent={EndingDataTableToolbar}
            paginationComponent={DataTablePaginationSimple}
            columnFilters={columnFilters}
            setColumnFilters={setColumnFilters}
            sorting={sorting}
            setSorting={setSorting}
            defaultColumnVisibility={{
              createdAt: false,
            }}
          />
        ) : null}
      </Section>
    </SectionGroup>
  );
}
