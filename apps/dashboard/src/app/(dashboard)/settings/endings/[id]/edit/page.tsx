"use client";

import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "~/components/content/section";
import { FormEndingUpdate } from "~/components/forms/endings/update";
import { useTRPC } from "~/lib/trpc/react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const trpc = useTRPC();
  const { data: ending } = useQuery(
    trpc.endings.getById.queryOptions({ id }),
  );

  if (!ending) return null;

  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>{ending.title}</SectionTitle>
          <SectionDescription>
            Personalize as configurações do motivo de finalização.
          </SectionDescription>
        </SectionHeader>
        <FormEndingUpdate />
      </Section>
    </SectionGroup>
  );
}
