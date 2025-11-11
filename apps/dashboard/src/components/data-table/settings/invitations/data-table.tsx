"use client";

import {
  EmptyStateContainer,
  EmptyStateDescription,
  EmptyStateTitle,
} from "~/components/content/empty-state";
import { QuickActions } from "~/components/dropdowns/quick-actions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@manylead/ui";
import { formatDate } from "~/lib/formatter";
import { useTRPC } from "~/lib/trpc/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { usePermissions } from "~/lib/permissions";

export function DataTable() {
  const trpc = useTRPC();
  const { data: invitations, refetch } = useQuery(
    trpc.invitation.list.queryOptions(),
  );
  const deleteInvitationMutation = useMutation(
    trpc.invitation.delete.mutationOptions({
      onSuccess: () => refetch(),
    }),
  );
  const { can } = usePermissions();

  if (!invitations) return null;

  if (invitations.length === 0) {
    return (
      <EmptyStateContainer>
        <EmptyStateTitle>Nenhum convite pendente</EmptyStateTitle>
        <EmptyStateDescription>
          Apenas convites ativos são mostrados aqui.
        </EmptyStateDescription>
      </EmptyStateContainer>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Email</TableHead>
          <TableHead>Cargo</TableHead>
          <TableHead>Criado em</TableHead>
          <TableHead>
            <span className="sr-only">Ações</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invitations.map((item) => {
          const roleLabels: Record<string, string> = {
            owner: "Proprietário",
            admin: "Admin",
            member: "Operador",
          };

          return (
            <TableRow key={item.id}>
              <TableCell>{item.email}</TableCell>
              <TableCell>{roleLabels[item.role ?? "member"] ?? item.role}</TableCell>
              <TableCell>{formatDate(item.createdAt)}</TableCell>
              <TableCell>
                <div className="flex justify-end">
                  {can("manage", "Agent") && (
                    <QuickActions
                      deleteAction={{
                        title: "Convite",
                        submitAction: async () =>
                          deleteInvitationMutation.mutateAsync({ id: item.id }),
                      }}
                    />
                  )}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
