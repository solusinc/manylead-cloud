"use client";

import type { ColumnFiltersState, SortingState } from "@tanstack/react-table";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import type { Contact } from "@manylead/db";

import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "~/components/content/section";
import { columns } from "~/components/data-table/contacts/columns";
import { ContactDataTableToolbar } from "~/components/data-table/contacts/data-table-toolbar";
import { DataTable } from "~/components/ui/data-table/data-table";
import { DataTablePaginationSimple } from "~/components/ui/data-table/data-table-pagination";
import { DataTableSkeleton } from "~/components/ui/data-table/data-table-skeleton";
import { useTRPC } from "~/lib/trpc/react";
import { ContactDetailsSheet } from "~/components/chat/contact/contact-details-sheet";
import type { Row } from "@tanstack/react-table";

export function Client() {
  const trpc = useTRPC();
  const { data, isLoading } = useQuery(
    trpc.contacts.list.queryOptions({ limit: 50, offset: 0 }),
  );
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  // Estado para o sheet de detalhes do contato
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const handleRowClick = (row: Row<Contact>) => {
    setSelectedContact(row.original);
    setSheetOpen(true);
  };

  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>Contatos</SectionTitle>
          <SectionDescription>
            Gerencie seus contatos na Manylead. No momento, está disponível a
            Importação de contatos.
          </SectionDescription>
        </SectionHeader>
      </Section>
      <Section>
        {isLoading ? (
          <DataTableSkeleton rows={5} />
        ) : data?.items ? (
          <DataTable
            columns={columns}
            data={data.items}
            toolbarComponent={ContactDataTableToolbar}
            paginationComponent={DataTablePaginationSimple}
            columnFilters={columnFilters}
            setColumnFilters={setColumnFilters}
            sorting={sorting}
            setSorting={setSorting}
            defaultColumnVisibility={{
              email: false,
              createdAt: false,
            }}
            onRowClick={handleRowClick}
          />
        ) : null}
      </Section>

      {selectedContact && (
        <ContactDetailsSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          contact={{
            id: selectedContact.id,
            name: selectedContact.name,
            phoneNumber: selectedContact.phoneNumber ?? "",
            avatar: selectedContact.avatar,
            customName: selectedContact.customName,
            notes: selectedContact.notes,
            customFields: selectedContact.customFields,
          }}
          source={selectedContact.metadata?.source === "internal" ? "internal" : "whatsapp"}
        />
      )}
    </SectionGroup>
  );
}
