"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "~/components/content/section";
import { FormCardGroup } from "~/components/forms/form-card";
import { FormMembers } from "~/components/forms/settings/form-members";
import { FormOrganization } from "~/components/forms/settings/form-organization";
import { FormSlug } from "~/components/forms/settings/form-slug";
import { useTRPC } from "~/lib/trpc/react";

export default function Page() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
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
      </Section>
    </SectionGroup>
  );
}
