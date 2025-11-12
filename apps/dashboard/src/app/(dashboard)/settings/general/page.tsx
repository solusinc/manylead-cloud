"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "~/components/content/section";
import {
  DangerZone,
  DangerZoneItem,
  DeleteOrganizationDialog,
} from "~/components/danger-zone";
import { FormCardGroup } from "~/components/forms/form-card";
import { FormMembers } from "~/components/forms/members/form-invite";
import { FormOrganization } from "~/components/forms/organization/form-general";
import { FormSlug } from "~/components/forms/organization/form-slug";
import { usePermissions } from "~/lib/permissions";
import { useTRPC } from "~/lib/trpc/react";

export default function Page() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { can } = usePermissions();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { data: organization, isLoading } = useQuery(
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

  if (isLoading) {
    return (
      <SectionGroup>
        <Section>
          <SectionHeader>
            <SectionTitle>Geral</SectionTitle>
            <SectionDescription>Carregando...</SectionDescription>
          </SectionHeader>
        </Section>
      </SectionGroup>
    );
  }

  if (!organization) {
    return (
      <SectionGroup>
        <Section>
          <SectionHeader>
            <SectionTitle>Geral</SectionTitle>
            <SectionDescription>
              Nenhuma organização ativa encontrada.
            </SectionDescription>
          </SectionHeader>
        </Section>
      </SectionGroup>
    );
  }

  const isOwner = can("delete", "Organization");

  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>Geral</SectionTitle>
          <SectionDescription>
            Gerencie as configurações da sua organização.
          </SectionDescription>
        </SectionHeader>
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
      </Section>

      <DeleteOrganizationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        organizationName={organization.name}
        onConfirm={async () => {
          await deleteOrganizationMutation.mutateAsync();
        }}
        isPending={deleteOrganizationMutation.isPending}
      />
    </SectionGroup>
  );
}
