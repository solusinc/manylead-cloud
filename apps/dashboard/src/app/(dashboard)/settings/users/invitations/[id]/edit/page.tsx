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
import { FormInvitationUpdate } from "~/components/forms/agents/form-invitation-update";
import { useTRPC } from "~/lib/trpc/react";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const trpc = useTRPC();
  const { data: invitation } = useQuery(trpc.invitation.getById.queryOptions({ id }));

  if (!invitation) return null;

  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>
            {invitation.email}
          </SectionTitle>
          <SectionDescription>
            Personalize as configurações e permissões do convite.
          </SectionDescription>
        </SectionHeader>
        <FormInvitationUpdate />
      </Section>
    </SectionGroup>
  );
}
