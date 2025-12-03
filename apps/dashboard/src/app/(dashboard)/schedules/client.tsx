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
import { ScheduledMessagesDataTableToolbar } from "~/components/data-table/scheduled-messages/data-table-toolbar";
import { ScheduledMessagesDataTableActionBar } from "~/components/data-table/scheduled-messages/data-table-action-bar";
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

  const currentView = searchParams.view;

  // Query para calendário - apenas pendentes
  const { data: calendarData, isLoading: isLoadingCalendar } = useQuery(
    trpc.scheduledMessages.listByOrganization.queryOptions({
      status: "pending",
      page: 1,
      pageSize: 100, // Máximo permitido pelo backend
    }),
  );

  // Query para lista - com filtros (padrão: apenas pendentes)
  const { data: listData, isLoading: isLoadingList } = useQuery(
    trpc.scheduledMessages.listByOrganization.queryOptions({
      status: searchParams.status ?? "pending",
      dateFrom: searchParams.dateFrom ?? undefined,
      dateTo: searchParams.dateTo ?? undefined,
      page: searchParams.page,
      pageSize: 50,
    }),
  );

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
        <SectionGroup className="max-w-7xl">
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
                <CalendarView data={calendarData} isLoading={isLoadingCalendar} />
              </TabsContent>

              <TabsContent value="list" className="mt-2">
                {isLoadingList ? (
                  <DataTableSkeleton rows={10} />
                ) : listData?.items ? (
                  <DataTable
                    columns={columns}
                    data={listData.items}
                    toolbarComponent={ScheduledMessagesDataTableToolbar}
                    actionBar={ScheduledMessagesDataTableActionBar}
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
