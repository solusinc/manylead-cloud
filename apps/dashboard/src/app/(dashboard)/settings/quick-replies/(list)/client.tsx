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
import { columns } from "~/components/data-table/quick-replies/columns";
import { QuickReplyDataTableActionBar } from "~/components/data-table/quick-replies/data-table-action-bar";
import { QuickReplyDataTableToolbar } from "~/components/data-table/quick-replies/data-table-toolbar";
import { DataTable } from "~/components/ui/data-table/data-table";
import { DataTablePaginationSimple } from "~/components/ui/data-table/data-table-pagination";
import { DataTableSkeleton } from "~/components/ui/data-table/data-table-skeleton";
import { useTRPC } from "~/lib/trpc/react";

export function Client() {
  const trpc = useTRPC();
  const { data: quickReplies, isLoading } = useQuery(
    trpc.quickReplies.listAdmin.queryOptions(),
  );
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>Respostas rápidas</SectionTitle>
          <SectionDescription>
            Respostas rápidas agilizam interações, simplifica ações e torna o
            seu atendimento mais eficiente.
          </SectionDescription>
        </SectionHeader>
      </Section>
      <Section>
        {isLoading ? (
          <DataTableSkeleton rows={5} />
        ) : quickReplies ? (
          <DataTable
            columns={columns}
            data={quickReplies}
            actionBar={QuickReplyDataTableActionBar}
            toolbarComponent={QuickReplyDataTableToolbar}
            paginationComponent={DataTablePaginationSimple}
            columnFilters={columnFilters}
            setColumnFilters={setColumnFilters}
            sorting={sorting}
            setSorting={setSorting}
            defaultColumnVisibility={{
              createdAt: false,
              usageCount: false,
            }}
          />
        ) : null}
      </Section>
    </SectionGroup>
  );
}
