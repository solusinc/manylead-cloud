"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";

import { Alert, AlertTitle } from "@manylead/ui";

import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "~/components/content/section";
import { FormCardGroup } from "~/components/forms/form-card";
import { FormCreateOrganization } from "~/components/forms/organization/form-create";
import { useProvisioningSocket } from "~/hooks/use-provisioning-socket";
import { useTRPC } from "~/lib/trpc/react";

export default function Page() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Socket.io para progresso em tempo real
  const socket = useProvisioningSocket();

  // Step 1: Initialize organization (fast ~1-2s)
  const initOrganization = useMutation(
    trpc.organization.init.mutationOptions({
      onError: (err) => {
        setIsProvisioning(false);
        setError(err.message || "Erro ao criar organização");
      },
    }),
  );

  // Step 2: Provision tenant (async background job)
  const provisionTenant = useMutation(
    trpc.organization.provision.mutationOptions({
      onError: (err) => {
        setIsProvisioning(false);
        socket.disconnect();
        setError(err.message || "Erro ao provisionar tenant");
      },
    }),
  );

  // Redirecionar quando provisioning completar via Socket.io
  useEffect(() => {
    if (socket.isComplete && isProvisioning) {
      // Invalidar queries para atualizar switcher
      void queryClient.invalidateQueries({
        queryKey: trpc.organization.list.queryKey(),
      });
      void queryClient.invalidateQueries({
        queryKey: trpc.organization.getCurrent.queryKey(),
      });

      const timer = setTimeout(() => {
        router.push("/overview");
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [socket.isComplete, isProvisioning, queryClient, trpc, router]);

  // Determinar o progresso atual
  const currentProgress = isProvisioning
    ? (socket.progress ?? {
        progress: 1,
        currentStep: "connecting",
        message: organizationId
          ? "Conectando ao servidor..."
          : "Criando organização...",
      })
    : null;

  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>Criar Organização</SectionTitle>
          <SectionDescription>
            Crie uma nova organização para começar a gerenciar sua equipe,
            projetos e recursos em um só lugar.
          </SectionDescription>
        </SectionHeader>
        <FormCardGroup>
          <FormCreateOrganization
            onSubmit={async (values) => {
              setError(null);
              setIsProvisioning(true);

              try {
                // PASSO 1: Inicializar organização (RÁPIDO ~1-2s)
                const org = await initOrganization.mutateAsync({
                  name: values.name,
                });

                setOrganizationId(org.id);

                // PASSO 2: Conectar Socket.io ANTES de provisionar
                socket.connect(org.id);

                // Aguardar um pouco para garantir que o socket conectou
                await new Promise((resolve) => setTimeout(resolve, 500));

                // PASSO 3: Provisionar tenant (dispara job e retorna imediatamente)
                await provisionTenant.mutateAsync({
                  organizationId: org.id,
                });
              } catch (err) {
                setIsProvisioning(false);
                setOrganizationId(null);
                socket.disconnect();
                setError(
                  err instanceof Error ? err.message : "Erro ao criar organização",
                );
              }
            }}
            disabled={isProvisioning}
          />

          {error && (
            <Alert className="bg-destructive/10 border-none mt-4">
              <AlertTriangle className="text-destructive! h-4 w-4" />
              <AlertTitle>{error}</AlertTitle>
            </Alert>
          )}

          {/* Mostrar progresso quando estiver provisionando */}
          {isProvisioning && currentProgress && (
            <div className="space-y-3 mt-4">
              <div className="space-y-2">
                <p className="text-muted-foreground text-sm">
                  {currentProgress.message}
                </p>
                <div className="bg-secondary h-2 w-full overflow-hidden rounded-full">
                  <div
                    className="bg-primary h-full transition-all duration-300"
                    style={{ width: `${currentProgress.progress}%` }}
                  />
                </div>
              </div>
              {socket.error && (
                <Alert className="bg-destructive/10 border-none">
                  <AlertTriangle className="text-destructive! h-4 w-4" />
                  <AlertTitle>{socket.error.error}</AlertTitle>
                </Alert>
              )}
            </div>
          )}
        </FormCardGroup>
      </Section>
    </SectionGroup>
  );
}
