"use client";

import { useTransition } from "react";
import { useForm } from "@tanstack/react-form";
import { isTRPCClientError } from "@trpc/client";
import { toast } from "sonner";
import { z } from "zod";

import { Button, Input } from "@manylead/ui";

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

export function FormCreateOrganization({
  onSubmit,
  disabled: externalDisabled,
  ...props
}: Omit<React.ComponentProps<"form">, "onSubmit"> & {
  onSubmit: (values: FormValues) => Promise<void>;
  disabled?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const disabled = externalDisabled || isPending;

  const form = useForm({
    defaultValues: {
      name: "",
    },
    onSubmit: ({ value }) => {
      if (disabled) return;

      startTransition(async () => {
        try {
          const promise = onSubmit(value);
          toast.promise(promise, {
            loading: "Aguarde...",
            success: () => "Organização criada com sucesso",
            error: (error) => {
              if (isTRPCClientError(error)) {
                return error.message;
              }
              return "Falha ao criar organização";
            },
          });
          await promise;
          // Reset form after success
          form.reset();
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
          <FormCardTitle>Nova Organização</FormCardTitle>
          <FormCardDescription>
            Crie uma nova organização. Você será automaticamente definido como
            proprietário.
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
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Ex: Minha Empresa"
                  disabled={disabled}
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
          <Button type="submit" disabled={disabled} size="sm">
            {disabled ? "Aguarde..." : "Criar"}
          </Button>
        </FormCardFooter>
      </FormCard>
    </form>
  );
}
