"use client";

import { useTransition } from "react";
import { useForm } from "@tanstack/react-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button, Input, Label } from "@manylead/ui";

import {
  FormCard,
  FormCardContent,
  FormCardDescription,
  FormCardFooter,
  FormCardHeader,
  FormCardTitle,
} from "~/components/forms/form-card";

const schema = z.object({
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
});

type FormValues = z.infer<typeof schema>;

interface FormUserProfileProps {
  defaultValues: {
    name: string;
    email: string;
  };
  onSubmit: (values: FormValues) => Promise<void>;
}

export function FormUserProfile({
  defaultValues,
  onSubmit,
}: FormUserProfileProps) {
  const [isPending, startTransition] = useTransition();

  const form = useForm({
    defaultValues: {
      name: defaultValues.name,
    },
    onSubmit: ({ value }) => {
      if (isPending) return;

      startTransition(async () => {
        try {
          const promise = onSubmit(value);
          toast.promise(promise, {
            loading: "Salvando...",
            success: () => "Salvo",
            error: "Falha ao salvar",
          });
          await promise;
        } catch (error) {
          console.error(error);
        }
      });
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <FormCard>
        <FormCardHeader>
          <FormCardTitle>Informações pessoais</FormCardTitle>
          <FormCardDescription>
            Atualize seu nome de exibição.
          </FormCardDescription>
        </FormCardHeader>
        <FormCardContent>
          <div className="grid gap-4">
            <form.Field
              name="name"
              validators={{
                onChange: ({ value }) => {
                  const result = schema.shape.name.safeParse(value);
                  if (!result.success) {
                    return (
                      result.error.issues[0]?.message ?? "Erro de validação"
                    );
                  }
                  return undefined;
                },
              }}
            >
              {(field) => (
                <div className="grid gap-2">
                  <Label htmlFor={field.name}>Nome</Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                  {field.state.meta.errors.length > 0 ? (
                    <p className="text-destructive text-sm">
                      {field.state.meta.errors[0]}
                    </p>
                  ) : null}
                </div>
              )}
            </form.Field>

            <div className="grid gap-2">
              <Label>Email</Label>
              <Input value={defaultValues.email} disabled />
              <p className="text-muted-foreground text-xs">
                O email não pode ser alterado.
              </p>
            </div>
          </div>
        </FormCardContent>
        <FormCardFooter>
          <Button type="submit" disabled={isPending} size="sm">
            {isPending ? "Salvando..." : "Salvar"}
          </Button>
        </FormCardFooter>
      </FormCard>
    </form>
  );
}
