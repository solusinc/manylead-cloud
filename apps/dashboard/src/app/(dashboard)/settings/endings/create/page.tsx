"use client";

import {
  Section,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "~/components/content/section";
import { FormGeneral } from "~/components/forms/endings/form-general";
import { useTRPC } from "~/lib/trpc/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

export default function Page() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  const createMutation = useMutation(
    trpc.endings.create.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.endings.list.queryKey(),
        });
        router.push("/settings/endings");
      },
    }),
  );

  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>Criar motivo de finalização</SectionTitle>
        </SectionHeader>
        <FormGeneral
          onSubmitAction={async (values) => {
            await createMutation.mutateAsync(values);
          }}
        />
      </Section>
    </SectionGroup>
  );
}
