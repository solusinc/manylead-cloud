"use client";

import {
  FormCard,
  FormCardContent,
  FormCardDescription,
  FormCardFooter,
  FormCardHeader,
  FormCardTitle,
} from "~/components/forms/form-card";
import { Button, Input, Label } from "@manylead/ui";
import { useForm } from "@tanstack/react-form";
import { useTransition } from "react";
import { toast } from "sonner";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
});

type FormValues = z.infer<typeof schema>;

export function FormOrganization({
  defaultValues,
  onSubmit,
  ...props
}: Omit<React.ComponentProps<"form">, "onSubmit"> & {
  defaultValues?: FormValues;
  onSubmit: (values: FormValues) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();

  const form = useForm({
    defaultValues: defaultValues ?? {
      name: "",
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
      {...props}
    >
      <FormCard>
        <FormCardHeader>
          <FormCardTitle>Organização</FormCardTitle>
          <FormCardDescription>
            Gerencie o nome da sua organização.
          </FormCardDescription>
        </FormCardHeader>
        <FormCardContent>
          <form.Field
            name="name"
            validators={{
              onChange: ({ value }) => {
                const result = schema.shape.name.safeParse(value);
                if (!result.success) {
                  return result.error.issues[0]?.message ?? "Erro de validação";
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
        </FormCardContent>
        <FormCardFooter>
          <Button type="submit" disabled={isPending} size="sm">
            {isPending ? "Enviando..." : "Enviar"}
          </Button>
        </FormCardFooter>
      </FormCard>
    </form>
  );
}
