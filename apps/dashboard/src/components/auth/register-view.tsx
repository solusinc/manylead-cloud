"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { Input } from "@manylead/ui/input";
import { Button } from "@manylead/ui/button";
import { Alert, AlertTitle } from "@manylead/ui";
import { Field, FieldLabel, FieldError } from "@manylead/ui/field";
import { authClient } from "~/lib/auth/client";

interface RegisterViewProps {
  callbackURL?: string;
}

export const RegisterView = ({ callbackURL = "/" }: RegisterViewProps) => {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Decode callbackURL if it's URL encoded
  const decodedCallbackURL = decodeURIComponent(callbackURL);

  const form = useForm({
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
    onSubmit: async ({ value }) => {
      setError(null);

      if (value.password !== value.confirmPassword) {
        setError("As senhas não coincidem");
        return;
      }

      setPending(true);

      try {
        await authClient.signUp.email({
          name: value.name,
          email: value.email,
          password: value.password,
        });
        setPending(false);
        router.push(decodedCallbackURL);
      } catch (err) {
        setPending(false);
        setError(err instanceof Error ? err.message : "Ocorreu um erro");
      }
    },
  });

  return (
    <div className="my-4 grid w-full max-w-lg gap-6">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="font-semibold text-3xl tracking-tight">Cadastrar</h1>
        <p className="text-muted-foreground text-sm">
          Comece agora. Não é necessário cartão de crédito.
        </p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void form.handleSubmit();
        }}
        className="grid gap-3 p-4"
        autoComplete="off"
      >
        <form.Field
          name="name"
          validators={{
            onChange: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
          }}
        >
          {(field) => {
            const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={field.name}>Nome</FieldLabel>
                <Input
                  id={field.name}
                  name="name"
                  type="text"
                  placeholder="John Doe"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  disabled={pending}
                  aria-invalid={isInvalid}
                  autoComplete="nope"
                />
                {isInvalid && <FieldError errors={field.state.meta.errors} />}
              </Field>
            );
          }}
        </form.Field>

        <form.Field
          name="email"
          validators={{
            onChange: z.string().email("Email inválido"),
          }}
        >
          {(field) => {
            const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={field.name}>E-mail</FieldLabel>
                <Input
                  id={field.name}
                  name="email"
                  type="email"
                  placeholder="m@example.com"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  disabled={pending}
                  aria-invalid={isInvalid}
                  autoComplete="nope"
                />
                {isInvalid && <FieldError errors={field.state.meta.errors} />}
              </Field>
            );
          }}
        </form.Field>

        <form.Field
          name="password"
          validators={{
            onChange: z.string().min(8, "Senha deve ter no mínimo 8 caracteres"),
          }}
        >
          {(field) => {
            const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={field.name}>Senha</FieldLabel>
                <Input
                  id={field.name}
                  name="password"
                  type="password"
                  placeholder="********"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  disabled={pending}
                  aria-invalid={isInvalid}
                  autoComplete="new-password"
                />
                {isInvalid && <FieldError errors={field.state.meta.errors} />}
              </Field>
            );
          }}
        </form.Field>

        <form.Field
          name="confirmPassword"
          validators={{
            onChange: z.string().min(1, "Por favor, confirme sua senha"),
          }}
        >
          {(field) => {
            const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={field.name}>Confirmar Senha</FieldLabel>
                <Input
                  id={field.name}
                  name="confirmPassword"
                  type="password"
                  placeholder="********"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  disabled={pending}
                  aria-invalid={isInvalid}
                  autoComplete="new-password"
                />
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

        <Button disabled={pending} type="submit" className="w-full">
          {pending ? "Criando conta..." : "Criar conta"}
        </Button>

        <div className="text-center text-sm">
          Já tem uma conta?{" "}
          <Link
            href={`/sign-in${decodedCallbackURL !== "/" ? `?callbackURL=${encodeURIComponent(decodedCallbackURL)}` : ""}`}
            className="underline underline-offset-4 hover:text-primary"
          >
            Entrar
          </Link>
        </div>
      </form>
      <p className="px-8 text-center text-muted-foreground text-sm">
        Ao continuar, você concorda com nossos{" "}
        <Link
          href="/legal/terms"
          className="underline underline-offset-4 hover:text-primary hover:no-underline"
        >
          Termos de Serviço
        </Link>{" "}
        e{" "}
        <Link
          href="/legal/privacy"
          className="underline underline-offset-4 hover:text-primary hover:no-underline"
        >
          Política de Privacidade
        </Link>
        .
      </p>
    </div>
  );
};
