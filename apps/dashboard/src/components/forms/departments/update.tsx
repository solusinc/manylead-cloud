"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";

import { FormCardGroup } from "~/components/forms/form-card";
import { useTRPC } from "~/lib/trpc/react";
import { FormGeneral } from "./form-general";

export function FormDepartmentUpdate() {
  const { id } = useParams<{ id: string }>();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data: department, refetch } = useQuery(
    trpc.departments.getById.queryOptions({ id }),
  );

  const updateMutation = useMutation(
    trpc.departments.update.mutationOptions({
      onSuccess: () => {
        // Invalidate list query to update the department in the list
        void queryClient.invalidateQueries({
          queryKey: trpc.departments.list.queryKey(),
        });
        void refetch();
        router.push("/settings/departments");
      },
    }),
  );

  if (!department) return null;

  return (
    <FormCardGroup>
      <FormGeneral
        defaultValues={{
          name: department.name,
          workingHours: department.workingHours
            ? {
                enabled: department.workingHours.enabled,
                timezone: department.workingHours.timezone,
                schedule: department.workingHours.schedule as {
                  monday: { start: string; end: string; enabled: boolean };
                  tuesday: { start: string; end: string; enabled: boolean };
                  wednesday: { start: string; end: string; enabled: boolean };
                  thursday: { start: string; end: string; enabled: boolean };
                  friday: { start: string; end: string; enabled: boolean };
                  saturday: { start: string; end: string; enabled: boolean };
                  sunday: { start: string; end: string; enabled: boolean };
                },
              }
            : undefined,
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
