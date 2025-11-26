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
import { columns } from "~/components/data-table/tags/columns";
import { TagDataTableActionBar } from "~/components/data-table/tags/data-table-action-bar";
import { TagDataTableToolbar } from "~/components/data-table/tags/data-table-toolbar";
import { DataTable } from "~/components/ui/data-table/data-table";
import { DataTablePaginationSimple } from "~/components/ui/data-table/data-table-pagination";
import { DataTableSkeleton } from "~/components/ui/data-table/data-table-skeleton";
import { useTRPC } from "~/lib/trpc/react";

export function Client() {
  const trpc = useTRPC();
  const { data: tags, isLoading } = useQuery(
    trpc.tags.list.queryOptions(),
  );
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>Etiquetas</SectionTitle>
          <SectionDescription>
            Etiquetas organizam informações, simplificam buscas e aprimoram a
            gestão de seus dados.
          </SectionDescription>
        </SectionHeader>
      </Section>
      <Section>
        {isLoading ? (
          <DataTableSkeleton rows={5} />
        ) : tags ? (
          <DataTable
            columns={columns}
            data={tags}
            actionBar={TagDataTableActionBar}
            toolbarComponent={TagDataTableToolbar}
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
