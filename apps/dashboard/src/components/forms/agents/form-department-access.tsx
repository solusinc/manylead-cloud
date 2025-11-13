"use client";

import { useTransition } from "react";
import { useForm } from "@tanstack/react-form";
import { isTRPCClientError } from "@trpc/client";
import { toast } from "sonner";

import { Button, Label } from "@manylead/ui";

import {
  FormCard,
  FormCardContent,
  FormCardDescription,
  FormCardFooter,
  FormCardHeader,
  FormCardTitle,
} from "~/components/forms/form-card";
import { DepartmentSelector } from "./department-selector";

interface FormValues {
  departmentIds: string[];
}

export function FormDepartmentAccess({
  onSubmitAction,
  defaultValues,
}: {
  onSubmitAction: (values: FormValues) => Promise<void>;
  defaultValues?: Partial<FormValues>;
}) {
  const [isPending, startTransition] = useTransition();

  const form = useForm({
    defaultValues: {
      departmentIds: defaultValues?.departmentIds ?? ([] as string[]),
    },
    onSubmit: ({ value }) => {
      if (isPending) return;

      startTransition(async () => {
        try {
          const promise = onSubmitAction(value);
          toast.promise(promise, {
            loading: "Salvando...",
            success: () => "Acesso aos departamentos atualizado com sucesso",
            error: (error) => {
              if (isTRPCClientError(error)) {
                return error.message;
              }
              return "Falha ao atualizar acesso aos departamentos";
            },
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
          <FormCardTitle>Acesso aos departamentos</FormCardTitle>
          <FormCardDescription>
            Defina quais departamentos este usuário poderá acessar.
          </FormCardDescription>
        </FormCardHeader>
        <FormCardContent>
          <form.Field name="departmentIds">
            {(field) => (
              <div className="grid gap-2">
                <Label>Departamentos</Label>
                <DepartmentSelector
                  value={field.state.value}
                  onChange={field.handleChange}
                  disabled={isPending}
                />
                <p className="text-muted-foreground text-sm">
                  Deixe vazio para permitir acesso a todos os departamentos
                  (atuais e futuros).
                </p>
              </div>
            )}
          </form.Field>
        </FormCardContent>
        <FormCardFooter>
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? "Salvando..." : "Salvar"}
          </Button>
        </FormCardFooter>
      </FormCard>
    </form>
  );
}
