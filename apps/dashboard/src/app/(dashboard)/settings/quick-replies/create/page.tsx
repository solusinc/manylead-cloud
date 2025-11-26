"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import {
  Section,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "~/components/content/section";
import { FormGeneral } from "~/components/forms/quick-replies/form-general";
import { useTRPC } from "~/lib/trpc/react";

export default function Page() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  const createMutation = useMutation(
    trpc.quickReplies.create.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.quickReplies.listAdmin.queryKey(),
        });
        router.push("/settings/quick-replies");
      },
    }),
  );

  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>Criar resposta rápida</SectionTitle>
        </SectionHeader>
        <FormGeneral
          onSubmitAction={async (values) => {
            await createMutation.mutateAsync({
              shortcut: values.shortcut,
              title: values.title,
              visibility: values.visibility,
              messages: values.messages,
            });
          }}
        />
      </Section>
    </SectionGroup>
  );
}
