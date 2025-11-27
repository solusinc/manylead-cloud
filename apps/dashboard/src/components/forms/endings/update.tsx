"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";

import { FormCardGroup } from "~/components/forms/form-card";
import { useTRPC } from "~/lib/trpc/react";
import { FormGeneral } from "./form-general";

export function FormEndingUpdate() {
  const { id } = useParams<{ id: string }>();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data: ending, refetch } = useQuery(
    trpc.endings.getById.queryOptions({ id }),
  );

  const updateMutation = useMutation(
    trpc.endings.update.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.endings.list.queryKey(),
        });
        void refetch();
        router.push("/settings/endings");
      },
    }),
  );

  if (!ending) return null;

  return (
    <FormCardGroup>
      <FormGeneral
        defaultValues={{
          title: ending.title,
          endingMessage: ending.endingMessage ?? "",
          ratingBehavior: ending.ratingBehavior as "default" | "enabled" | "disabled",
        }}
        onSubmitAction={async (values) => {
          await updateMutation.mutateAsync({
            id,
            data: values,
          });
        }}
      />
    </FormCardGroup>
  );
}
