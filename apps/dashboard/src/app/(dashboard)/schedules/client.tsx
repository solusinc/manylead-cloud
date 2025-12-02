"use client";

import type { ColumnFiltersState, SortingState } from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";
import { Calendar as CalendarIcon, List as ListIcon } from "lucide-react";
import { useQueryStates } from "nuqs";
import { useState } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@manylead/ui/tabs";

import {
  AppHeader,
  AppHeaderContent,
} from "~/components/nav/app-header";
import { AppSidebarTrigger } from "~/components/nav/app-sidebar";
import { NavBreadcrumb } from "~/components/nav/nav-breadcrumb";
import { CalendarView } from "~/components/schedules/calendar-view";
import { columns } from "~/components/data-table/scheduled-messages/columns";
import { Section, SectionGroup } from "~/components/content/section";
import { DataTable } from "~/components/ui/data-table/data-table";
import { DataTablePaginationSimple } from "~/components/ui/data-table/data-table-pagination";
import { DataTableSkeleton } from "~/components/ui/data-table/data-table-skeleton";
import { useTRPC } from "~/lib/trpc/react";

import { searchParamsParsers } from "./search-params";

export function Client() {
  const trpc = useTRPC();
  const [searchParams, setSearchParams] = useQueryStates(searchParamsParsers);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "scheduledAt", desc: false },
  ]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  // Fetch scheduled messages
  const { data, isLoading } = useQuery(
    trpc.scheduledMessages.listByOrganization.queryOptions({
      status: searchParams.status ?? undefined,
      dateFrom: searchParams.dateFrom ?? undefined,
      dateTo: searchParams.dateTo ?? undefined,
      page: searchParams.page,
      pageSize: 50,
    }),
  );

  const currentView = searchParams.view;

  return (
    <>
      {/* Header */}
      <AppHeader>
        <AppHeaderContent>
          <AppSidebarTrigger />
          <NavBreadcrumb
            items={[{ type: "page", label: "Agendamentos", icon: CalendarIcon }]}
          />
        </AppHeaderContent>
      </AppHeader>

      {/* Content */}
      <main className="flex-1 overflow-auto">
        <SectionGroup>
          <Section>
            <Tabs
              value={currentView}
              onValueChange={(v) => {
                if (v === "calendar" || v === "list") {
                  void setSearchParams({ view: v });
                }
              }}
            >
              <TabsList>
                <TabsTrigger value="calendar">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  Calendário
                </TabsTrigger>
                <TabsTrigger value="list">
                  <ListIcon className="mr-2 h-4 w-4" />
                  Lista
                </TabsTrigger>
              </TabsList>

              <TabsContent value="calendar" className="mt-0">
                <CalendarView data={data} isLoading={isLoading} />
              </TabsContent>

              <TabsContent value="list" className="mt-0">
                {isLoading ? (
                  <DataTableSkeleton rows={10} />
                ) : data?.items ? (
                  <DataTable
                    columns={columns}
                    data={data.items}
                    paginationComponent={DataTablePaginationSimple}
                    columnFilters={columnFilters}
                    setColumnFilters={setColumnFilters}
                    sorting={sorting}
                    setSorting={setSorting}
                  />
                ) : null}
              </TabsContent>
            </Tabs>
          </Section>
        </SectionGroup>
      </main>
    </>
  );
}
