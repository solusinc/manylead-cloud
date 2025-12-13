"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { Pencil, Send } from "lucide-react";
import { toast } from "sonner";

export function DataTable() {
  const router = useRouter();
  const trpc = useTRPC();
  const { data: invitations, refetch } = useQuery(
    trpc.invitation.list.queryOptions(),
  );
  const deleteInvitationMutation = useMutation(
    trpc.invitation.delete.mutationOptions({
      onSuccess: () => refetch(),
    }),
  );
  const resendInvitationMutation = useMutation(
    trpc.invitation.resend.mutationOptions({
      onSuccess: () => {
        toast.success("Convite reenviado com sucesso!");
        void refetch();
      },
      onError: (error) => {
        toast.error(error.message);
      },
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
            owner: "Administrador",
            admin: "Supervisor",
            member: "Agente",
          };

          return (
            <TableRow key={item.id}>
              <TableCell>
                <Link
                  href={`/settings/users/invitations/${item.id}/edit`}
                  className="text-foreground hover:underline"
                >
                  {item.email}
                </Link>
              </TableCell>
              <TableCell>{roleLabels[item.role ?? "member"] ?? item.role}</TableCell>
              <TableCell>{formatDate(item.createdAt)}</TableCell>
              <TableCell>
                <div className="flex justify-end">
                  {can("manage", "Agent") && (
                    <QuickActions
                      actions={[
                        {
                          id: "resend",
                          label: "Reenviar",
                          icon: Send,
                          variant: "default" as const,
                          onClick: () => {
                            resendInvitationMutation.mutate({ id: item.id });
                          },
                        },
                        {
                          id: "edit",
                          label: "Editar",
                          icon: Pencil,
                          variant: "default" as const,
                          onClick: () => {
                            router.push(`/settings/users/invitations/${item.id}/edit`);
                          },
                        },
                      ]}
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
