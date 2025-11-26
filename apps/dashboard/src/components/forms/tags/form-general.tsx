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
  name: z
    .string()
    .min(1, "Nome e obrigatorio")
    .max(100, "Nome deve ter no maximo 100 caracteres"),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Cor deve estar no formato hex (#RRGGBB)"),
});

// Gera uma cor hex aleatória vibrante (evita cores muito claras/escuras)
export function generateRandomColor(): string {
  const hue = Math.floor(Math.random() * 360);
  const saturation = 65 + Math.floor(Math.random() * 20); // 65-85%
  const lightness = 45 + Math.floor(Math.random() * 15); // 45-60%

  // Converter HSL para HEX
  const h = hue / 360;
  const s = saturation / 100;
  const l = lightness / 100;

  const hueToRgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = Math.round(hueToRgb(p, q, h + 1 / 3) * 255);
  const g = Math.round(hueToRgb(p, q, h) * 255);
  const b = Math.round(hueToRgb(p, q, h - 1 / 3) * 255);

  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

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
      name: defaultValues?.name ?? "",
      color: defaultValues?.color ?? "#3b82f6",
    },
    onSubmit: ({ value }) => {
      if (isPending) return;

      startTransition(async () => {
        try {
          const promise = onSubmitAction(value);
          toast.promise(promise, {
            loading: "Salvando...",
            success: () => "Etiqueta salva com sucesso",
            error: (error) => {
              if (isTRPCClientError(error)) {
                return error.message;
              }
              return "Falha ao salvar etiqueta";
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
          <FormCardTitle>Informacoes Gerais</FormCardTitle>
          <FormCardDescription>
            Configure as informacoes basicas da etiqueta.
          </FormCardDescription>
        </FormCardHeader>
        <FormCardSeparator />
        <FormCardContent>
          <div className="grid gap-6">
            <form.Field
              name="name"
              validators={{
                onChange: ({ value }) => {
                  const result = schema.shape.name.safeParse(value);
                  if (!result.success) {
                    return (
                      result.error.issues[0]?.message ?? "Erro de validacao"
                    );
                  }
                  return undefined;
                },
              }}
            >
              {(field) => (
                <div className="grid gap-2">
                  <Label htmlFor={field.name}>Titulo da etiqueta</Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Ex: Aguardando retorno"
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
              name="color"
              validators={{
                onChange: ({ value }) => {
                  const result = schema.shape.color.safeParse(value);
                  if (!result.success) {
                    return (
                      result.error.issues[0]?.message ?? "Erro de validacao"
                    );
                  }
                  return undefined;
                },
              }}
            >
              {(field) => (
                <div className="grid gap-2">
                  <Label htmlFor={field.name}>Cor da etiqueta</Label>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <input
                        type="color"
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        className="h-10 w-12 cursor-pointer rounded-md border bg-transparent p-1"
                      />
                    </div>
                    <Input
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="#000000"
                      className="w-28 font-mono"
                      maxLength={7}
                    />
                  </div>
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
