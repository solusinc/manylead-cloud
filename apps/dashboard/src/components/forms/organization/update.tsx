"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  DangerZone,
  DangerZoneItem,
  DeleteOrganizationDialog,
} from "~/components/danger-zone";
import { FormCardGroup } from "~/components/forms/form-card";
// import { FormMembers } from "~/components/forms/members/form-invite";
import { FormOrganization } from "./form-general";
import { FormWorkingHours } from "./form-working-hours";
import { FormMessages } from "./form-messages";
import { FormPreferences } from "./form-preferences";
// import { FormSlug } from "./form-slug";
import { usePermissions } from "~/lib/permissions";
import { useTRPC } from "~/lib/trpc/react";

export function FormOrganizationUpdate() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { can } = usePermissions();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { data: organization } = useQuery(
    trpc.organization.getCurrent.queryOptions(),
  );

  const { data: settings } = useQuery(
    trpc.organizationSettings.get.queryOptions(),
  );

  const updateOrganizationNameMutation = useMutation(
    trpc.organization.updateName.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.organization.getCurrent.queryKey(),
        });
        void queryClient.invalidateQueries({
          queryKey: trpc.organization.list.queryKey(),
        });
      },
    }),
  );

  const updateTimezoneMutation = useMutation(
    trpc.organizationSettings.updateTimezone.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.organizationSettings.get.queryKey(),
        });
      },
    }),
  );

  const updateWorkingHoursMutation = useMutation(
    trpc.organizationSettings.updateWorkingHours.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.organizationSettings.get.queryKey(),
        });
      },
    }),
  );

  const updateMessagesMutation = useMutation(
    trpc.organizationSettings.updateMessages.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.organizationSettings.get.queryKey(),
        });
      },
    }),
  );

  const updatePreferencesMutation = useMutation(
    trpc.organizationSettings.updatePreferences.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.organizationSettings.get.queryKey(),
        });
      },
    }),
  );

  // const createInvitationMutation = useMutation(
  //   trpc.invitation.create.mutationOptions({
  //     onSuccess: () => {
  //       void queryClient.invalidateQueries({
  //         queryKey: trpc.invitation.list.queryKey(),
  //       });
  //     },
  //   }),
  // );

  const deleteOrganizationMutation = useMutation(
    trpc.organization.delete.mutationOptions({
      onSuccess: () => {
        // Fechar dialog
        setDeleteDialogOpen(false);

        // Invalidar queries
        void queryClient.invalidateQueries({
          queryKey: trpc.organization.getCurrent.queryKey(),
        });
        void queryClient.invalidateQueries({
          queryKey: trpc.organization.list.queryKey(),
        });

        // Redirecionar para outra org ou onboarding
        router.push("/overview");
      },
    }),
  );

  if (!organization || !settings) return null;

  const isOwner = can("delete", "Organization");

  return (
    <>
      <FormCardGroup>
        <FormOrganization
          defaultValues={{ name: organization.name }}
          slug={organization.slug}
          onSubmit={async (values) => {
            await updateOrganizationNameMutation.mutateAsync({
              name: values.name,
            });
          }}
        />
        <FormWorkingHours
          defaultValues={{
            timezone: settings.timezone,
            workingHours: settings.workingHours ?? {
              enabled: false,
              schedule: {
                monday: { start: "09:00", end: "18:00", enabled: true },
                tuesday: { start: "09:00", end: "18:00", enabled: true },
                wednesday: { start: "09:00", end: "18:00", enabled: true },
                thursday: { start: "09:00", end: "18:00", enabled: true },
                friday: { start: "09:00", end: "18:00", enabled: true },
                saturday: { start: "09:00", end: "13:00", enabled: false },
                sunday: { start: "09:00", end: "13:00", enabled: false },
              },
            },
          }}
          onSubmitAction={async (values) => {
            await updateTimezoneMutation.mutateAsync({
              timezone: values.timezone,
            });
            await updateWorkingHoursMutation.mutateAsync({
              workingHours: values.workingHours,
            });
          }}
        />
        <FormMessages
          defaultValues={{
            welcomeMessage: settings.welcomeMessage ?? undefined,
            closingMessage: settings.closingMessage ?? undefined,
          }}
          onSubmitAction={async (values) => {
            await updateMessagesMutation.mutateAsync(values);
          }}
        />
        <FormPreferences
          defaultValues={{
            ratingEnabled: settings.ratingEnabled,
            includeUserName: settings.includeUserName,
            hidePhoneDigits: settings.hidePhoneDigits,
          }}
          onSubmitAction={async (values) => {
            await updatePreferencesMutation.mutateAsync(values);
          }}
        />
        {/* Temporarily hidden - team members moved to dedicated agents page */}
        {/* <FormMembers
          onCreate={async (values) => {
            await createInvitationMutation.mutateAsync({
              email: values.email,
            });
          }}
        /> */}
      </FormCardGroup>

      {isOwner && (
        <DangerZone>
          <DangerZoneItem
            title=""
            description=""
            action="Deletar Organização"
            onAction={() => setDeleteDialogOpen(true)}
          />
        </DangerZone>
      )}

      <DeleteOrganizationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        organizationName={organization.name}
        onConfirm={async () => {
          await deleteOrganizationMutation.mutateAsync();
        }}
        isPending={deleteOrganizationMutation.isPending}
      />
    </>
  );
}
