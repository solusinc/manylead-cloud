"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "~/components/content/section";
import { FormAgentUpdate } from "~/components/forms/agents/update";
import { useTRPC } from "~/lib/trpc/react";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const trpc = useTRPC();
  const { data: agent } = useQuery(trpc.agents.getById.queryOptions({ id }));

  if (!agent) return null;

  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>
            {agent.user?.name ?? agent.user?.email ?? "Usuário"}
          </SectionTitle>
          <SectionDescription>
            Personalize as configurações e permissões do usuário.
          </SectionDescription>
        </SectionHeader>
        <FormAgentUpdate />
      </Section>
    </SectionGroup>
  );
}
