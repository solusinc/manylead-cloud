"use client";

import { useTransition } from "react";
import { useForm } from "@tanstack/react-form";
import { toast } from "sonner";
import { z } from "zod";
import { Check, Copy } from "lucide-react";

import { Button, Input, Label } from "@manylead/ui";

import {
  FormCard,
  FormCardContent,
  FormCardDescription,
  FormCardFooter,
  FormCardHeader,
  FormCardTitle,
} from "~/components/forms/form-card";
import { useCopyToClipboard } from "~/hooks/use-copy-to-clipboard";

const schema = z.object({
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
});

type FormValues = z.infer<typeof schema>;

export function FormOrganization({
  defaultValues,
  slug,
  onSubmit,
  ...props
}: Omit<React.ComponentProps<"form">, "onSubmit"> & {
  defaultValues?: FormValues;
  slug?: string;
  onSubmit: (values: FormValues) => Promise<void>;
}) {
  const { copy, isCopied } = useCopyToClipboard();
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
            Gerencie o nome e identificador da sua organização.
          </FormCardDescription>
        </FormCardHeader>
        <FormCardContent>
          <div className="grid gap-6">
            <div className="grid gap-4 sm:grid-cols-3">
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
                  <div className="grid gap-2 sm:col-span-2">
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

              {slug && (
                <div className="grid gap-2">
                  <Label>Slug</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="default"
                    className="w-full justify-start"
                    onClick={() =>
                      copy(slug, {
                        successMessage: "Slug copiado para a área de transferência",
                      })
                    }
                  >
                    {slug}
                    {isCopied ? (
                      <Check size={16} className="ml-auto text-muted-foreground" />
                    ) : (
                      <Copy size={16} className="ml-auto text-muted-foreground" />
                    )}
                  </Button>
                </div>
              )}
            </div>

            {slug && (
              <p className="text-muted-foreground text-sm">
                O slug é usado ao interagir com a API e não pode ser alterado. Entre em contato se precisar alterá-lo.
              </p>
            )}
          </div>
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
