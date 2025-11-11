"use client";

import {
  Section,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "~/components/content/section";
import { FormInviteAgent } from "~/components/forms/agents/form-invite";
import { useTRPC } from "~/lib/trpc/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

export default function Page() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  const createMutation = useMutation(
    trpc.invitation.create.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.invitation.list.queryKey(),
        });
        router.push("/settings/agents");
      },
    }),
  );

  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>Convidar Atendente</SectionTitle>
        </SectionHeader>
        <FormInviteAgent
          onSubmitAction={async (values) => {
            await createMutation.mutateAsync(values);
          }}
          onSuccess={() => {
            router.push("/settings/agents");
          }}
        />
      </Section>
    </SectionGroup>
  );
}
