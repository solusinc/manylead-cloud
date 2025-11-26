"use client";

import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "~/components/content/section";
import { FormTagUpdate } from "~/components/forms/tags/update";
import { useTRPC } from "~/lib/trpc/react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const trpc = useTRPC();
  const { data: tag } = useQuery(
    trpc.tags.getById.queryOptions({ id }),
  );

  if (!tag) return null;

  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>{tag.name}</SectionTitle>
          <SectionDescription>
            Personalize as configuracoes da sua etiqueta.
          </SectionDescription>
        </SectionHeader>
        <FormTagUpdate />
      </Section>
    </SectionGroup>
  );
}
