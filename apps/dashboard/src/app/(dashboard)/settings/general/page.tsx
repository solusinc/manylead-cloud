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
          <SectionTitle>Geral</SectionTitle>
          <SectionDescription>
            Gerencie as configurações da sua organização.
          </SectionDescription>
        </SectionHeader>
        <FormOrganizationUpdate />
      </Section>
    </SectionGroup>
  );
}
