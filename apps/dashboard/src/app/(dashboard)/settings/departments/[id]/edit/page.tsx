"use client";

import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "~/components/content/section";
import { FormDepartmentUpdate } from "~/components/forms/departments/update";
import { useTRPC } from "~/lib/trpc/react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const trpc = useTRPC();
  const { data: department } = useQuery(
    trpc.departments.getById.queryOptions({ id }),
  );

  if (!department) return null;

  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>{department.name}</SectionTitle>
          <SectionDescription>
            Personalize as configurações do seu departamento.
          </SectionDescription>
        </SectionHeader>
        <FormDepartmentUpdate />
      </Section>
    </SectionGroup>
  );
}
