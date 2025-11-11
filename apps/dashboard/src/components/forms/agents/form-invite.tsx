"use client";

import { useTransition } from "react";
import { useForm } from "@tanstack/react-form";
import { isTRPCClientError } from "@trpc/client";
import { z } from "zod";
import { toast } from "sonner";

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
import { Crown, Key, User } from "lucide-react";

import {
  FormCard,
  FormCardContent,
  FormCardDescription,
  FormCardFooter,
  FormCardHeader,
  FormCardTitle,
} from "~/components/forms/form-card";

const formSchema = z.object({
  email: z.string().email("Email inválido"),
  role: z.enum(["owner", "admin", "member"]),
});

type FormValues = z.infer<typeof formSchema>;

const roleLabels = {
  owner: "Proprietário",
  admin: "Admin",
  member: "Operador",
} as const;

const roleDescriptions = {
  owner: "Tem todas as permissões na ferramenta e tem acesso ao painel financeiro.",
  admin: "Tem todas as permissões na ferramenta, porém não tem acesso ao painel financeiro.",
  member: "É capaz de enviar mensagens para contatos e pode alterar configurações básicas que são úteis aos atendentes.",
} as const;

const roleIcons = {
  owner: Crown,
  admin: Key,
  member: User,
} as const;

export function FormInviteAgent({
  locked,
  onSuccess,
  onSubmitAction,
}: {
  locked?: boolean;
  onSuccess?: () => void;
  onSubmitAction: (values: FormValues) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();

  const form = useForm({
    defaultValues: {
      email: "",
      role: "member" as FormValues["role"],
    },
    onSubmit: ({ value }) => {
      if (isPending) return;

      startTransition(async () => {
        try {
          const promise = onSubmitAction(value);
          toast.promise(promise, {
            loading: "Salvando...",
            success: () => {
              form.reset();
              onSuccess?.();
              return "Convite enviado com sucesso";
            },
            error: (error) => {
              if (isTRPCClientError(error)) {
                return error.message;
              }
              return "Falha ao enviar convite";
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
          <FormCardTitle>Informações do Convite</FormCardTitle>
          <FormCardDescription>
            Configure as informações do membro que será convidado.
          </FormCardDescription>
        </FormCardHeader>
        <FormCardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <form.Field
              name="email"
              validators={{
                onChange: ({ value }) => {
                  const result = formSchema.shape.email.safeParse(value);
                  if (!result.success) {
                    return result.error.issues[0]?.message ?? "Erro de validação";
                  }
                  return undefined;
                },
              }}
            >
              {(field) => (
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor={field.name}>Email do membro</Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="email"
                    placeholder="email@exemplo.com"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    disabled={locked ?? isPending}
                  />
                  {field.state.meta.errors.length > 0 ? (
                    <p className="text-destructive text-sm">
                      {field.state.meta.errors[0]}
                    </p>
                  ) : null}
                </div>
              )}
            </form.Field>

            <form.Field name="role">
              {(field) => (
                <div className="grid gap-2 sm:col-span-1">
                  <Label htmlFor={field.name}>Nível de acesso</Label>
                  <Select
                    value={field.state.value}
                    onValueChange={(value) => {
                      field.handleChange(value as FormValues["role"]);
                    }}
                    disabled={locked ?? isPending}
                  >
                    <SelectTrigger id={field.name}>
                      <SelectValue>
                        <div className="flex items-center gap-2">
                          {(() => {
                            const Icon = roleIcons[field.state.value];
                            return <Icon className="h-4 w-4" />;
                          })()}
                          {roleLabels[field.state.value]}
                        </div>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="w-[calc(100vw-2rem)] sm:w-[--radix-select-trigger-width] max-w-[500px]">
                      {(Object.keys(roleLabels) as (keyof typeof roleLabels)[]).map(
                        (role) => {
                          const Icon = roleIcons[role];
                          return (
                            <SelectItem key={role} value={role} className="py-3">
                              <div className="flex items-start gap-2 sm:gap-3">
                                <Icon className="mt-0.5 h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                                  <span className="font-medium text-sm">{roleLabels[role]}</span>
                                  <span className="text-xs text-muted-foreground leading-relaxed">
                                    {roleDescriptions[role]}
                                  </span>
                                </div>
                              </div>
                            </SelectItem>
                          );
                        },
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </form.Field>
          </div>
        </FormCardContent>
        <FormCardFooter>
          <Button type="submit" size="sm" disabled={isPending || (locked ?? false)}>
            {isPending ? "Enviando..." : "Enviar"}
          </Button>
        </FormCardFooter>
      </FormCard>
    </form>
  );
}
