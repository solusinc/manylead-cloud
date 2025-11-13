"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  DangerZone,
  DangerZoneItem,
  DeleteOrganizationDialog,
} from "~/components/danger-zone";
import { FormCardGroup } from "~/components/forms/form-card";
import { FormMembers } from "~/components/forms/members/form-invite";
import { FormOrganization } from "./form-general";
import { FormSlug } from "./form-slug";
import { usePermissions } from "~/lib/permissions";
import { useTRPC } from "~/lib/trpc/react";

export function FormOrganizationUpdate() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { can } = usePermissions();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { data: organization } = useQuery(
    trpc.organization.getCurrent.queryOptions(),
  );

  const updateOrganizationNameMutation = useMutation(
    trpc.organization.updateName.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.organization.getCurrent.queryKey(),
        });
        void queryClient.invalidateQueries({
          queryKey: trpc.organization.list.queryKey(),
        });
      },
    }),
  );

  const createInvitationMutation = useMutation(
    trpc.invitation.create.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.invitation.list.queryKey(),
        });
      },
    }),
  );

  const deleteOrganizationMutation = useMutation(
    trpc.organization.delete.mutationOptions({
      onSuccess: () => {
        // Fechar dialog
        setDeleteDialogOpen(false);

        // Invalidar queries
        void queryClient.invalidateQueries({
          queryKey: trpc.organization.getCurrent.queryKey(),
        });
        void queryClient.invalidateQueries({
          queryKey: trpc.organization.list.queryKey(),
        });

        // Redirecionar para outra org ou onboarding
        router.push("/overview");
      },
    }),
  );

  if (!organization) return null;

  const isOwner = can("delete", "Organization");

  return (
    <>
      <FormCardGroup>
        <FormOrganization
          defaultValues={{ name: organization.name }}
          onSubmit={async (values) => {
            await updateOrganizationNameMutation.mutateAsync({
              name: values.name,
            });
          }}
        />
        <FormSlug defaultValues={{ slug: organization.slug }} />
        <FormMembers
          onCreate={async (values) => {
            await createInvitationMutation.mutateAsync({
              email: values.email,
            });
          }}
        />
      </FormCardGroup>

      {isOwner && (
        <div className="mt-8">
          <DangerZone>
            <DangerZoneItem
              title="Deletar Organização"
              description="Uma vez deletada, não será possível recuperar esta organização. Todos os dados serão permanentemente deletados."
              action="Deletar Organização"
              onAction={() => setDeleteDialogOpen(true)}
            />
          </DangerZone>
        </div>
      )}

      <DeleteOrganizationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        organizationName={organization.name}
        onConfirm={async () => {
          await deleteOrganizationMutation.mutateAsync();
        }}
        isPending={deleteOrganizationMutation.isPending}
      />
    </>
  );
}
