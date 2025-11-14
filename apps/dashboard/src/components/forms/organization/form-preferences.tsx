"use client";

import { useTransition } from "react";
import { useForm } from "@tanstack/react-form";
import { isTRPCClientError } from "@trpc/client";
import { toast } from "sonner";
import { z } from "zod";

import { Button, Label, Switch } from "@manylead/ui";

import {
  FormCard,
  FormCardContent,
  FormCardDescription,
  FormCardFooter,
  FormCardHeader,
  FormCardSeparator,
  FormCardTitle,
} from "~/components/forms/form-card";

const _schema = z.object({
  ratingEnabled: z.boolean(),
  includeUserName: z.boolean(),
  hidePhoneDigits: z.boolean(),
});

type FormValues = z.infer<typeof _schema>;

export function FormPreferences({
  onSubmitAction,
  defaultValues,
}: {
  onSubmitAction: (values: FormValues) => Promise<void>;
  defaultValues?: Partial<FormValues>;
}) {
  const [isPending, startTransition] = useTransition();

  const form = useForm({
    defaultValues: {
      ratingEnabled: defaultValues?.ratingEnabled ?? false,
      includeUserName: defaultValues?.includeUserName ?? false,
      hidePhoneDigits: defaultValues?.hidePhoneDigits ?? false,
    },
    onSubmit: ({ value }) => {
      if (isPending) return;

      startTransition(async () => {
        try {
          const promise = onSubmitAction(value);
          toast.promise(promise, {
            loading: "Salvando...",
            success: () => "Preferências salvas com sucesso",
            error: (error) => {
              if (isTRPCClientError(error)) {
                return error.message;
              }
              return "Falha ao salvar preferências";
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
          <FormCardTitle>Preferências de atendimento</FormCardTitle>
          <FormCardDescription>
            Configure como os atendimentos serão realizados e quais informações
            serão exibidas.
          </FormCardDescription>
        </FormCardHeader>
        <FormCardSeparator />
        <FormCardContent className="grid gap-4">
          <form.Field name="ratingEnabled">
            {(field) => (
              <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor={field.name}>Avaliação de atendimento</Label>
                  <p className="text-muted-foreground text-sm">
                    Após finalizar um atendimento, envia uma mensagem automática
                    solicitando que o cliente dê uma nota entre 1 e 5.
                  </p>
                </div>
                <Switch
                  id={field.name}
                  checked={field.state.value}
                  onCheckedChange={field.handleChange}
                />
              </div>
            )}
          </form.Field>

          <form.Field name="includeUserName">
            {(field) => (
              <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor={field.name}>
                    Identificar nome do usuário
                  </Label>
                  <p className="text-muted-foreground text-sm">
                    Inclui o nome do usuário nas mensagens enviadas, tornando o
                    atendimento mais personalizado.
                  </p>
                </div>
                <Switch
                  id={field.name}
                  checked={field.state.value}
                  onCheckedChange={field.handleChange}
                />
              </div>
            )}
          </form.Field>

          <form.Field name="hidePhoneDigits">
            {(field) => (
              <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor={field.name}>
                    Ocultar números de telefone
                  </Label>
                  <p className="text-muted-foreground text-sm">
                    Oculta os 4 últimos dígitos do telefone para proteção de
                    privacidade (ex: +55 11 98765-XXXX).
                  </p>
                </div>
                <Switch
                  id={field.name}
                  checked={field.state.value}
                  onCheckedChange={field.handleChange}
                />
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
