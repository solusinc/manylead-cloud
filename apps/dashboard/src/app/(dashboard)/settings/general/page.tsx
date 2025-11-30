"use client";

import { useQuery } from "@tanstack/react-query";

import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "~/components/content/section";
import { FormOrganizationUpdate } from "~/components/forms/organization/update";
import { OrganizationLogoUpload } from "~/components/forms/organization/logo-upload";
import { useTRPC } from "~/lib/trpc/react";

export default function Page() {
  const trpc = useTRPC();
  const { data: organization } = useQuery(
    trpc.organization.getCurrent.queryOptions(),
  );

  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>Ajustes gerais</SectionTitle>
          <SectionDescription>
            Os principais ajustes da Manylead estão aqui. Mensagens boas vindas/finalização, regras de utilização, horário de atendimento e mais.
          </SectionDescription>
        </SectionHeader>
        {organization && (
          <OrganizationLogoUpload
            currentLogo={organization.logo}
            organizationName={organization.name}
            className="mb-6"
          />
        )}
        <FormOrganizationUpdate />
      </Section>
    </SectionGroup>
  );
}
