"use client";

import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "~/components/content/section";
import { FormOrganizationUpdate } from "~/components/forms/organization/update";

export default function Page() {
  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>Ajustes gerais</SectionTitle>
          <SectionDescription>
            Os principais ajustes da Manylead estão aqui. Mensagens boas vindas/finalização, regras de utilização, horário de atendimento e mais.
          </SectionDescription>
        </SectionHeader>
        <FormOrganizationUpdate />
      </Section>
    </SectionGroup>
  );
}
