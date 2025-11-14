"use client";

import {
  Section,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "~/components/content/section";
import { FormGeneral } from "~/components/forms/channels/form-general";
import { useTRPC } from "~/lib/trpc/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

export default function Page() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  const createMutation = useMutation(
    trpc.channels.create.mutationOptions({
      onSuccess: (data) => {
        void queryClient.invalidateQueries({
          queryKey: trpc.channels.list.queryKey(),
        });
        // Redirecionar para página de QR Code
        router.push(`/settings/channels/${data.id}/qrcode`);
      },
    }),
  );

  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>Criar canal</SectionTitle>
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
