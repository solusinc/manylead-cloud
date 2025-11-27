"use client";

import { useTransition } from "react";
import { useForm } from "@tanstack/react-form";
import { isTRPCClientError } from "@trpc/client";
import { toast } from "sonner";
import { z } from "zod";

import {
  Button,
  Input,
  Label,
  Textarea,
} from "@manylead/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@manylead/ui/select";

import {
  FormCard,
  FormCardContent,
  FormCardDescription,
  FormCardFooter,
  FormCardHeader,
  FormCardSeparator,
  FormCardTitle,
} from "~/components/forms/form-card";

const schema = z.object({
  title: z
    .string()
    .min(1, "Título é obrigatório")
    .max(100, "Título deve ter no máximo 100 caracteres"),
  endingMessage: z
    .string()
    .max(1000, "Mensagem deve ter no máximo 1000 caracteres")
    .optional(),
  ratingBehavior: z.enum(["default", "enabled", "disabled"]),
});

type FormValues = z.infer<typeof schema>;

export function FormGeneral({
  onSubmitAction,
  defaultValues,
}: {
  onSubmitAction: (values: FormValues) => Promise<void>;
  defaultValues?: Partial<FormValues>;
}) {
  const [isPending, startTransition] = useTransition();

  const form = useForm({
    defaultValues: {
      title: defaultValues?.title ?? "",
      endingMessage: defaultValues?.endingMessage ?? "",
      ratingBehavior: defaultValues?.ratingBehavior ?? "default",
    },
    onSubmit: ({ value }) => {
      if (isPending) return;

      startTransition(async () => {
        try {
          const promise = onSubmitAction(value);
          toast.promise(promise, {
            loading: "Salvando...",
            success: () => "Motivo salvo com sucesso",
            error: (error) => {
              if (isTRPCClientError(error)) {
                return error.message;
              }
              return "Falha ao salvar motivo";
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
          <FormCardTitle>Informações Gerais</FormCardTitle>
          <FormCardDescription>
            Configure as informações básicas do motivo de finalização.
          </FormCardDescription>
        </FormCardHeader>
        <FormCardSeparator />
        <FormCardContent>
          <div className="grid gap-6">
            <form.Field
              name="title"
              validators={{
                onChange: ({ value }) => {
                  const result = schema.shape.title.safeParse(value);
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
                  <Label htmlFor={field.name}>Título do motivo de finalização</Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Ex: Dúvida, Resolvido, Pendente"
                  />
                  {field.state.meta.errors.length > 0 ? (
                    <p className="text-destructive text-sm">
                      {field.state.meta.errors[0]}
                    </p>
                  ) : null}
                </div>
              )}
            </form.Field>

            <form.Field name="endingMessage">
              {(field) => (
                <div className="grid gap-2">
                  <Label htmlFor={field.name}>Mensagem de finalização</Label>
                  <p className="text-muted-foreground text-sm">
                    Opcional. Mensagem enviada sempre que um atendimento for finalizado.
                  </p>
                  <Textarea
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Ex: Obrigado pelo contato! Esperamos ter ajudado."
                    rows={4}
                  />
                </div>
              )}
            </form.Field>

            <form.Field name="ratingBehavior">
              {(field) => (
                <div className="grid gap-2">
                  <Label htmlFor={field.name}>Avaliação de Atendimento</Label>
                  <Select
                    value={field.state.value}
                    onValueChange={(value) => field.handleChange(value as "default" | "enabled" | "disabled")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma opção" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Padrão da instância</SelectItem>
                      <SelectItem value="enabled">Ativado</SelectItem>
                      <SelectItem value="disabled">Desativado</SelectItem>
                    </SelectContent>
                  </Select>
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
