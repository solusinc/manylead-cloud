"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@manylead/ui";
import { Button } from "@manylead/ui/button";
import { Input } from "@manylead/ui/input";
import { Field, FieldLabel, FieldError } from "@manylead/ui/field";
import { Alert, AlertTitle } from "@manylead/ui";
import { AlertTriangle, Check, X, Loader2 } from "lucide-react";

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
        setError(err instanceof Error ? err.message : "Erro ao criar organização");
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
          <CardTitle className="text-2xl">Bem-vindo ao ManyLead!</CardTitle>
          <CardDescription>
            Vamos começar criando sua organização. Você poderá convidar membros da equipe depois.
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
                onChange: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
              }}
            >
              {(field) => {
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                const slug = slugify(field.state.value);

                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>Nome da Organização</FieldLabel>
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
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          {checkingAvailability && (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          )}
                          {!checkingAvailability && availability && (
                            <>
                              {availability.available ? (
                                <Check className="h-4 w-4 text-green-500" />
                              ) : (
                                <X className="h-4 w-4 text-destructive" />
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                  </Field>
                );
              }}
            </form.Field>

            {error && (
              <Alert className="border-none bg-destructive/10">
                <AlertTriangle className="h-4 w-4 text-destructive!" />
                <AlertTitle>{error}</AlertTitle>
              </Alert>
            )}
          </CardContent>
          <CardFooter className="pt-6">
            <Button
              disabled={pending || checkingAvailability || (availability && !availability.available)}
              type="submit"
              className="w-full"
            >
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {pending ? "Criando organização..." : "Criar organização"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
