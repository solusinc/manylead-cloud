"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";

import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "~/components/content/section";
import { FormGeneral } from "~/components/forms/quick-replies/form-general";
import { useTRPC } from "~/lib/trpc/react";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data: quickReply } = useQuery(
    trpc.quickReplies.getById.queryOptions({ id }),
  );

  const updateMutation = useMutation(
    trpc.quickReplies.update.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.quickReplies.listAdmin.queryKey(),
        });
        void queryClient.invalidateQueries({
          queryKey: trpc.quickReplies.getById.queryKey({ id }),
        });
        router.push("/settings/quick-replies");
      },
    }),
  );

  if (!quickReply) return null;

  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>{quickReply.title}</SectionTitle>
          <SectionDescription>
            Edite as configurações da sua resposta rápida.
          </SectionDescription>
        </SectionHeader>
        <FormGeneral
          defaultValues={{
            shortcut: quickReply.shortcut,
            title: quickReply.title,
            messages: quickReply.messages,
            visibility: quickReply.visibility as "organization" | "private",
          }}
          onSubmitAction={async (values) => {
            await updateMutation.mutateAsync({
              id,
              data: {
                shortcut: values.shortcut,
                title: values.title,
                visibility: values.visibility,
                messages: values.messages,
              },
            });
          }}
        />
      </Section>
    </SectionGroup>
  );
}
