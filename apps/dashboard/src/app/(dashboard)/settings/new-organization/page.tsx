"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "~/components/content/section";
import { FormCardGroup } from "~/components/forms/form-card";
import { FormCreateOrganization } from "~/components/forms/settings/form-create-organization";
import { useTRPC } from "~/lib/trpc/react";

export default function Page() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  const createOrganizationMutation = useMutation(
    trpc.organization.create.mutationOptions({
      onSuccess: () => {
        // Invalidar queries para atualizar switcher
        void queryClient.invalidateQueries({
          queryKey: trpc.organization.list.queryKey(),
        });
        void queryClient.invalidateQueries({
          queryKey: trpc.organization.getCurrent.queryKey(),
        });
        // Redirecionar para overview
        router.push("/overview");
      },
    }),
  );

  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>Criar Organização</SectionTitle>
          <SectionDescription>
            Crie uma nova organização para começar a gerenciar sua equipe,
            projetos e recursos em um só lugar.
          </SectionDescription>
        </SectionHeader>
        <FormCardGroup>
          <FormCreateOrganization
            onSubmit={async (values) => {
              await createOrganizationMutation.mutateAsync({
                name: values.name,
              });
            }}
          />
        </FormCardGroup>
      </Section>
    </SectionGroup>
  );
}
