"use client";

import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "~/components/content/section";
import { FormAgentUpdate } from "~/components/forms/agents/update";
import { useTRPC } from "~/lib/trpc/react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { ChevronRight } from "lucide-react";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const trpc = useTRPC();
  const { data: agent } = useQuery(trpc.agents.getById.queryOptions({ id }));

  if (!agent) return null;

  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>Editar membro</SectionTitle>
          <SectionDescription>
            Personalize as configurações e permissões do membro.
          </SectionDescription>
        </SectionHeader>
        <FormAgentUpdate />
      </Section>
    </SectionGroup>
  );
}
