"use client";

import {
  Section,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "~/components/content/section";
import { FormGeneral } from "~/components/forms/departments/form-general";
import { useTRPC } from "~/lib/trpc/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

export default function Page() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  const createDepartmentMutation = useMutation(
    trpc.departments.create.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.departments.list.queryKey(),
        });
        router.push("/settings/departments");
      },
    }),
  );

  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>Criar Departamento</SectionTitle>
        </SectionHeader>
        <FormGeneral
          onSubmit={async (data) => {
            await createDepartmentMutation.mutateAsync({
              name: data.name,
              description: data.description ?? undefined,
              autoAssignment: data.autoAssignment,
            });
          }}
        />
      </Section>
    </SectionGroup>
  );
}
