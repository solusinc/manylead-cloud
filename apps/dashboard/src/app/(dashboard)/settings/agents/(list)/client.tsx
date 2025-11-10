"use client";

import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "~/components/content/section";
import { columns } from "~/components/data-table/agents/columns";
import { AgentDataTableActionBar } from "~/components/data-table/agents/data-table-action-bar";
import { AgentDataTableToolbar } from "~/components/data-table/agents/data-table-toolbar";
import { DataTable } from "~/components/ui/data-table/data-table";
import { DataTableSkeleton } from "~/components/ui/data-table/data-table-skeleton";
import { DataTablePaginationSimple } from "~/components/ui/data-table/data-table-pagination";
import { useTRPC } from "~/lib/trpc/react";
import { useQuery } from "@tanstack/react-query";
import type { ColumnFiltersState, SortingState } from "@tanstack/react-table";
import { useState } from "react";

export function Client() {
  const trpc = useTRPC();
  const { data: agents, isLoading } = useQuery(trpc.agents.list.queryOptions());
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>Atendentes</SectionTitle>
          <SectionDescription>
            Gerencie sua equipe de atendimento e suas permissões.
          </SectionDescription>
        </SectionHeader>
      </Section>
      <Section>
        {isLoading ? (
          <DataTableSkeleton rows={5} />
        ) : agents ? (
          <DataTable
            columns={columns}
            data={agents}
            actionBar={AgentDataTableActionBar}
            toolbarComponent={AgentDataTableToolbar}
            paginationComponent={DataTablePaginationSimple}
            columnFilters={columnFilters}
            setColumnFilters={setColumnFilters}
            sorting={sorting}
            setSorting={setSorting}
            defaultColumnVisibility={{
              email: false,
              createdAt: false,
            }}
          />
        ) : null}
      </Section>
    </SectionGroup>
  );
}
