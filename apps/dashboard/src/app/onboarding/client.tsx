"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

import { useTRPC } from "~/lib/trpc/react";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove acentos
    .replace(/[^a-z0-9]+/g, "-") // Substitui caracteres especiais por -
    .replace(/^-+|-+$/g, ""); // Remove - do início e fim
}

export function OnboardingClient() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [debouncedName, setDebouncedName] = useState("");
  const trpc = useTRPC();

  const createOrganization = useMutation(
    trpc.organization.create.mutationOptions({
      onSuccess: () => {
        router.push("/overview");
      },
      onError: (err) => {
        setPending(false);
        setError(err.message || "Erro ao criar organização");
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

      try {
        await createOrganization.mutateAsync({
          name: value.name,
        });
      } catch (err) {
        setPending(false);
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
                const slug = slugify(field.state.value);

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
                        className={slug ? "pr-10" : ""}
                      />
                      {slug && (
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
              {pending ? "Aguarde..." : "Criar"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
