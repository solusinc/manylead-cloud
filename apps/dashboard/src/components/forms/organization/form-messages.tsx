"use client";

import { useTransition } from "react";
import { useForm } from "@tanstack/react-form";
import { isTRPCClientError } from "@trpc/client";
import { toast } from "sonner";
import { z } from "zod";

import { Button, Label, Textarea } from "@manylead/ui";

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
  welcomeMessage: z.string().optional(),
  closingMessage: z.string().optional(),
});

type FormValues = z.infer<typeof _schema>;

export function FormMessages({
  onSubmitAction,
  defaultValues,
}: {
  onSubmitAction: (values: FormValues) => Promise<void>;
  defaultValues?: Partial<FormValues>;
}) {
  const [isPending, startTransition] = useTransition();

  const form = useForm({
    defaultValues: {
      welcomeMessage: defaultValues?.welcomeMessage ?? "",
      closingMessage: defaultValues?.closingMessage ?? "",
    },
    onSubmit: ({ value }) => {
      if (isPending) return;

      startTransition(async () => {
        try {
          const promise = onSubmitAction(value);
          toast.promise(promise, {
            loading: "Salvando...",
            success: () => "Mensagens salvas com sucesso",
            error: (error) => {
              if (isTRPCClientError(error)) {
                return error.message;
              }
              return "Falha ao salvar mensagens";
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
          <FormCardTitle>Mensagens automáticas</FormCardTitle>
          <FormCardDescription>
            Configure mensagens que serão enviadas automaticamente durante o
            atendimento.
          </FormCardDescription>
        </FormCardHeader>
        <FormCardSeparator />
        <FormCardContent>
          <div className="grid gap-4">
            <form.Field name="welcomeMessage">
              {(field) => (
                <div className="grid gap-2">
                  <Label htmlFor={field.name}>Mensagem de boas-Vindas</Label>
                  <Textarea
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Ex: Olá! Bem-vindo ao nosso atendimento. Como posso ajudar?"
                    rows={3}
                    className="resize-none"
                  />
                </div>
              )}
            </form.Field>

            <form.Field name="closingMessage">
              {(field) => (
                <div className="grid gap-2">
                  <Label htmlFor={field.name}>Mensagem de finalização</Label>
                  <Textarea
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Ex: Atendimento finalizado. Obrigado pelo contato!"
                    rows={3}
                    className="resize-none"
                  />
                </div>
              )}
            </form.Field>
          </div>
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
