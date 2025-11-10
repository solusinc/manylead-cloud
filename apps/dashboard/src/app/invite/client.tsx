"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import { useQueryStates } from "nuqs";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@manylead/ui";
import { Button } from "@manylead/ui/button";

import { authClient } from "~/lib/auth/client";
import { useTRPC } from "~/lib/trpc/react";
import { searchParamsParsers } from "./search-params";

export function Client() {
  const trpc = useTRPC();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [{ token }] = useQueryStates(searchParamsParsers);
  const { refetch: refetchSession } = authClient.useSession();
  const { data: invitation, error } = useQuery({
    ...trpc.invitation.get.queryOptions({ token }),
    retry: false,
  });
  const acceptInvitationMutation = useMutation(
    trpc.invitation.accept.mutationOptions({
      onSuccess: () => {
        // Refresh session to get new organization
        void refetchSession();
        router.push("/overview");
      },
    }),
  );

  if (isTRPCClientError(error)) {
    return (
      <div className="container mx-auto flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle className="text-destructive">Erro</CardTitle>
            <CardDescription className="font-mono">
              {error.message}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!invitation) return null;

  return (
    <div className="container mx-auto flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Convite de Organização</CardTitle>
          <CardDescription>
            Você foi convidado para participar da organização
            {invitation.organization?.name ? (
              <span className="font-semibold">{` ${invitation.organization.name}`}</span>
            ) : (
              ""
            )}
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            className="w-full"
            onClick={() => {
              startTransition(async () => {
                try {
                  const promise = acceptInvitationMutation.mutateAsync({
                    invitationId: invitation.id,
                  });
                  toast.promise(promise, {
                    loading: "Aceitando convite...",
                    success: "Convite aceito",
                    error: (error) => {
                      if (isTRPCClientError(error)) {
                        return error.message;
                      }
                      return "Falha ao aceitar convite";
                    },
                  });
                  await promise;
                } catch (error) {
                  console.error(error);
                }
              });
            }}
            disabled={isPending}
          >
            {isPending ? "Aceitando..." : "Aceitar Convite"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
