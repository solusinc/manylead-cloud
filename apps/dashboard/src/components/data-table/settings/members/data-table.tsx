import { QuickActions } from "~/components/dropdowns/quick-actions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@manylead/ui";
import { formatDate } from "~/lib/formatter";
import { useTRPC } from "~/lib/trpc/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useSession } from "~/lib/auth/client";

export function DataTable() {
  const trpc = useTRPC();
  const { data: session } = useSession();
  const { data: members, refetch } = useQuery(trpc.member.list.queryOptions());
  const deleteMemberMutation = useMutation(
    trpc.member.delete.mutationOptions({
      onSuccess: () => refetch(),
    }),
  );

  if (!members) return null;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Cargo</TableHead>
          <TableHead>Criado em</TableHead>
          <TableHead>
            <span className="sr-only">Ações</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((item) => {
          const isOwner = item.role === "owner";
          const isCurrentUser = session?.user.id === item.user.id;
          const canDelete = !isOwner && !isCurrentUser;

          return (
            <TableRow key={item.user.id}>
              <TableCell>{item.user.name}</TableCell>
              <TableCell>{item.user.email}</TableCell>
              <TableCell>{item.role}</TableCell>
              <TableCell>{formatDate(item.user.createdAt)}</TableCell>
              <TableCell>
                <div className="flex justify-end">
                  {canDelete ? (
                    <QuickActions
                      deleteAction={{
                        title: "Membro",
                        confirmationValue: "deletar membro",
                        submitAction: async () =>
                          await deleteMemberMutation.mutateAsync({
                            id: item.user.id,
                          }),
                      }}
                    />
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
