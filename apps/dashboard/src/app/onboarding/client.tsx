"use client";

import { useEffect, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Check, Loader2, X } from "lucide-react";
import { z } from "zod";

import {
  Alert,
  AlertTitle,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@manylead/ui";
import { Button } from "@manylead/ui/button";
import { Field, FieldError, FieldLabel } from "@manylead/ui/field";
import { Input } from "@manylead/ui/input";

import { useProvisioningSocket } from "~/hooks/use-provisioning-socket";
import { useTRPC } from "~/lib/trpc/react";

export function OnboardingClient() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [debouncedName, setDebouncedName] = useState("");
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const trpc = useTRPC();

  // Socket.io para progresso em tempo real
  const socket = useProvisioningSocket();

  // Step 1: Initialize organization (fast ~1-2s)
  const initOrganization = useMutation(
    trpc.organization.init.mutationOptions({
      onError: (err) => {
        setPending(false);
        setIsProvisioning(false);
        setError(err.message || "Erro ao criar organização");
      },
    }),
  );

  // Step 2: Provision tenant (async background job)
  const provisionTenant = useMutation(
    trpc.organization.provision.mutationOptions({
      onError: (err) => {
        setPending(false);
        setIsProvisioning(false);
        socket.disconnect();
        setError(err.message || "Erro ao provisionar tenant");
      },
    }),
  );

  const form = useForm({
    defaultValues: {
      name: "",
    },
    onSubmit: async ({ value }) => {
      setError(null);
      setPending(true);
      setIsProvisioning(true);

      try {
        // PASSO 1: Inicializar organização (RÁPIDO ~1-2s)
        console.log("[Onboarding] Step 1: Initializing organization...");
        const org = await initOrganization.mutateAsync({
          name: value.name,
        });

        console.log("[Onboarding] Organization initialized:", org.id);
        setOrganizationId(org.id);

        // PASSO 2: Conectar Socket.io ANTES de provisionar
        console.log("[Onboarding] Step 2: Connecting to Socket.io...");
        socket.connect(org.id);

        // Aguardar um pouco para garantir que o socket conectou
        await new Promise((resolve) => setTimeout(resolve, 500));

        // PASSO 3: Provisionar tenant (dispara job e retorna imediatamente)
        console.log("[Onboarding] Step 3: Starting tenant provisioning...");
        await provisionTenant.mutateAsync({
          organizationId: org.id,
        });

        console.log("[Onboarding] Provisioning started! Listening to Socket.io...");
      } catch (err) {
        setPending(false);
        setIsProvisioning(false);
        setOrganizationId(null);
        socket.disconnect();
        setError(
          err instanceof Error ? err.message : "Erro ao criar organização",
        );
      }
    },
  });

  // Debounce do nome da organização (500ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedName(nameInput);
    }, 500);

    return () => clearTimeout(timer);
  }, [nameInput]);

  // Redirecionar quando provisioning completar via Socket.io
  useEffect(() => {
    if (socket.isComplete && isProvisioning) {
      console.log("[Onboarding] Provisioning complete!");

      const timer = setTimeout(() => {
        console.log("[Onboarding] Redirecting to /overview");
        window.location.href = "/overview";
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [socket.isComplete, isProvisioning]);

  // Verificar disponibilidade da organização
  const { data: availability, isLoading: checkingAvailability } = useQuery(
    trpc.organization.checkOrganizationAvailability.queryOptions(
      { name: debouncedName },
      {
        enabled: debouncedName.length >= 2,
        retry: false,
      },
    ),
  );

  // Determinar o progresso atual
  const currentProgress = isProvisioning
    ? (socket.progress ?? {
        progress: 1,
        currentStep: "connecting",
        message:
          pending && !organizationId
            ? "Criando organização..."
            : "Conectando ao servidor...",
      })
    : null;

  return (
    <div className="container mx-auto flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Bem vindo a Manylead</CardTitle>
          <CardDescription>
            Vamos começar criando sua organização. Você poderá convidar membros
            da equipe depois.
          </CardDescription>
        </CardHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void form.handleSubmit();
          }}
        >
          <CardContent className="space-y-4">
            <form.Field
              name="name"
              validators={{
                onChange: z
                  .string()
                  .min(2, "Nome deve ter no mínimo 2 caracteres"),
              }}
            >
              {(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid;
                const showAvailabilityIndicator = field.state.value.length >= 2;

                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>
                      Nome da Organização
                    </FieldLabel>
                    <div className="relative">
                      <Input
                        id={field.name}
                        name="name"
                        type="text"
                        placeholder="Minha Empresa"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => {
                          field.handleChange(e.target.value);
                          setNameInput(e.target.value);
                        }}
                        disabled={pending}
                        aria-invalid={isInvalid}
                        autoComplete="organization"
                        className={showAvailabilityIndicator ? "pr-10" : ""}
                      />
                      {showAvailabilityIndicator && (
                        <div className="absolute top-1/2 right-3 -translate-y-1/2">
                          {checkingAvailability && (
                            <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
                          )}
                          {!checkingAvailability && availability && (
                            <>
                              {availability.available ? (
                                <Check className="h-4 w-4 text-green-500" />
                              ) : (
                                <X className="text-destructive h-4 w-4" />
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                );
              }}
            </form.Field>

            {error && (
              <Alert className="bg-destructive/10 border-none">
                <AlertTriangle className="text-destructive! h-4 w-4" />
                <AlertTitle>{error}</AlertTitle>
              </Alert>
            )}

            {/* Mostrar progresso abaixo do form quando estiver provisionando */}
            {isProvisioning && currentProgress && (
              <div className="space-y-3">
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
          </CardContent>
          <CardFooter className="pt-6">
            <Button
              disabled={
                pending ||
                checkingAvailability ||
                (availability && !availability.available)
              }
              type="submit"
              className="w-full"
            >
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {socket.isComplete
                ? "Redirecionando..."
                : pending
                  ? "Aguarde..."
                  : "Criar"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
