"use client";

import { useTransition } from "react";
import { useForm } from "@tanstack/react-form";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button, Label } from "@manylead/ui";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@manylead/ui/input-group";

import {
  FormCard,
  FormCardContent,
  FormCardDescription,
  FormCardFooter,
  FormCardHeader,
  FormCardTitle,
} from "~/components/forms/form-card";

const schema = z
  .object({
    currentPassword: z.string().min(1, "Senha atual é obrigatória"),
    newPassword: z.string().min(8, "Nova senha deve ter no mínimo 8 caracteres"),
    confirmPassword: z.string().min(1, "Confirme a nova senha"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

interface FormChangePasswordProps {
  onSubmit: (values: { currentPassword: string; newPassword: string }) => Promise<void>;
}

export function FormChangePassword({ onSubmit }: FormChangePasswordProps) {
  const [isPending, startTransition] = useTransition();

  const form = useForm({
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
    onSubmit: ({ value }) => {
      if (isPending) return;

      // Validate with zod
      const result = schema.safeParse(value);
      if (!result.success) {
        toast.error(result.error.issues[0]?.message ?? "Erro de validação");
        return;
      }

      startTransition(async () => {
        try {
          const promise = onSubmit({
            currentPassword: value.currentPassword,
            newPassword: value.newPassword,
          });
          toast.promise(promise, {
            loading: "Alterando senha...",
            success: () => {
              // Reset form on success
              form.reset();
              return "Senha alterada com sucesso";
            },
            error: (err) => {
              if (err instanceof Error) {
                return err.message;
              }
              return "Falha ao alterar senha";
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
          <FormCardTitle>Alterar senha</FormCardTitle>
          <FormCardDescription>
            Atualize sua senha de acesso.
          </FormCardDescription>
        </FormCardHeader>
        <FormCardContent>
          <div className="grid gap-4">
            {/* Senha atual - metade da largura */}
            <form.Field name="currentPassword">
              {(field) => (
                <div className="grid gap-2 sm:max-w-sm">
                  <Label htmlFor={field.name}>Senha atual</Label>
                  <InputGroup>
                    <InputGroupAddon>
                      <Lock className="size-4" />
                    </InputGroupAddon>
                    <InputGroupInput
                      id={field.name}
                      name={field.name}
                      type="password"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      autoComplete="current-password"
                    />
                  </InputGroup>
                </div>
              )}
            </form.Field>

            {/* Nova senha e Confirmar - mesma linha */}
            <div className="grid gap-4 sm:grid-cols-2">
              <form.Field
                name="newPassword"
                validators={{
                  onChange: ({ value }) => {
                    if (value.length > 0 && value.length < 8) {
                      return "Nova senha deve ter no mínimo 8 caracteres";
                    }
                    return undefined;
                  },
                }}
              >
                {(field) => (
                  <div className="grid gap-2">
                    <Label htmlFor={field.name}>Nova senha</Label>
                    <InputGroup>
                      <InputGroupAddon>
                        <Lock className="size-4" />
                      </InputGroupAddon>
                      <InputGroupInput
                        id={field.name}
                        name={field.name}
                        type="password"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        autoComplete="new-password"
                      />
                    </InputGroup>
                    {field.state.meta.errors.length > 0 ? (
                      <p className="text-destructive text-sm">
                        {field.state.meta.errors[0]}
                      </p>
                    ) : null}
                  </div>
                )}
              </form.Field>

              <form.Field
                name="confirmPassword"
                validators={{
                  onChangeListenTo: ["newPassword"],
                  onChange: ({ value, fieldApi }) => {
                    const newPassword = fieldApi.form.getFieldValue("newPassword");
                    if (value && value !== newPassword) {
                      return "As senhas não coincidem";
                    }
                    return undefined;
                  },
                }}
              >
                {(field) => (
                  <div className="grid gap-2">
                    <Label htmlFor={field.name}>Digite novamente</Label>
                    <InputGroup>
                      <InputGroupAddon>
                        <Lock className="size-4" />
                      </InputGroupAddon>
                      <InputGroupInput
                        id={field.name}
                        name={field.name}
                        type="password"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        autoComplete="new-password"
                      />
                    </InputGroup>
                    {field.state.meta.errors.length > 0 ? (
                      <p className="text-destructive text-sm">
                        {field.state.meta.errors[0]}
                      </p>
                    ) : null}
                  </div>
                )}
              </form.Field>
            </div>
          </div>
        </FormCardContent>
        <FormCardFooter>
          <Button type="submit" disabled={isPending} size="sm">
            {isPending ? "Alterando..." : "Alterar senha"}
          </Button>
        </FormCardFooter>
      </FormCard>
    </form>
  );
}
