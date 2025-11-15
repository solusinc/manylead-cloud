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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@manylead/ui";

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
  channelType: z.enum(["qr_code", "official"]),
  displayName: z
    .string()
    .min(1, "Nome é obrigatório")
    .max(255, "Nome deve ter no máximo 255 caracteres"),
  phoneNumber: z
    .string()
    .regex(/^\+[1-9]\d{1,14}$/, "Formato inválido. Use +5511999999999")
    .optional()
    .or(z.literal("")),
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
      channelType: defaultValues?.channelType ?? ("qr_code" as const),
      displayName: defaultValues?.displayName ?? "",
      phoneNumber: defaultValues?.phoneNumber ?? "",
    },
    onSubmit: ({ value }) => {
      if (isPending) return;

      startTransition(async () => {
        try {
          // Remove phoneNumber se vazio
          const data = {
            ...value,
            phoneNumber: value.phoneNumber || undefined,
          };

          const promise = onSubmitAction(data);
          toast.promise(promise, {
            loading: "Salvando...",
            success: () => "Canal salvo com sucesso",
            error: (error) => {
              if (isTRPCClientError(error)) {
                return error.message;
              }
              return "Falha ao salvar canal";
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
            Configure as informações básicas do canal WhatsApp.
          </FormCardDescription>
        </FormCardHeader>
        <FormCardSeparator />
        <FormCardContent>
          <div className="grid gap-4">
            {/* Channel Type */}
            <form.Field name="channelType">
              {(field) => (
                <div className="grid gap-2">
                  <Label htmlFor={field.name}>Tipo de Canal</Label>
                  <Select
                    value={field.state.value}
                    onValueChange={(value) =>
                      field.handleChange(value as "qr_code" | "official")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="qr_code">
                        QR Code (Não oficial)
                      </SelectItem>
                      <SelectItem value="official">
                        Oficial (WhatsApp Business API)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-muted-foreground text-xs">
                    {field.state.value === "qr_code"
                      ? "Conexão via QR Code - ideal para começar rapidamente"
                      : "WhatsApp Business API oficial - requer aprovação Meta"}
                  </p>
                </div>
              )}
            </form.Field>

            <form.Field
              name="displayName"
              validators={{
                onChange: ({ value }) => {
                  const result = schema.shape.displayName.safeParse(value);
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
                  <Label htmlFor={field.name}>Nome do canal</Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Ex: Suporte - WhatsApp"
                  />
                  {field.state.meta.errors.length > 0 ? (
                    <p className="text-destructive text-sm">
                      {field.state.meta.errors[0]}
                    </p>
                  ) : null}
                </div>
              )}
            </form.Field>

            <form.Field
              name="phoneNumber"
              validators={{
                onChange: ({ value }) => {
                  if (!value) return undefined;
                  const result = schema.shape.phoneNumber.safeParse(value);
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
                  <Label htmlFor={field.name}>
                    Número de telefone (opcional)
                  </Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="+5511999999999"
                  />
                  <p className="text-muted-foreground text-xs">
                    Formato internacional com código do país (ex: +55 para
                    Brasil)
                  </p>
                  {field.state.meta.errors.length > 0 ? (
                    <p className="text-destructive text-sm">
                      {field.state.meta.errors[0]}
                    </p>
                  ) : null}
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
