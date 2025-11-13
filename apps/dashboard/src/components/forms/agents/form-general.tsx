"use client";

import { useTransition } from "react";
import { useForm } from "@tanstack/react-form";
import { isTRPCClientError } from "@trpc/client";
import { toast } from "sonner";
import { Crown, Key, User } from "lucide-react";

import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
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
import { DepartmentSelector } from "./department-selector";

interface FormValues {
  role: "owner" | "admin" | "member";
  isActive: boolean;
  departmentIds: string[];
}

const roleLabels = {
  owner: "Proprietário",
  admin: "Admin",
  member: "Operador",
} as const;

const roleDescriptions = {
  owner:
    "Tem todas as permissões na ferramenta e tem acesso ao painel financeiro.",
  admin:
    "Tem todas as permissões na ferramenta, porém não tem acesso ao painel financeiro.",
  member:
    "É capaz de enviar mensagens para contatos e pode alterar configurações básicas que são úteis aos atendentes.",
} as const;

const roleIcons = {
  owner: Crown,
  admin: Key,
  member: User,
} as const;

interface FormGeneralProps {
  defaultValues: FormValues & { email: string };
  onSubmit: (values: FormValues) => Promise<void>;
  disabled?: boolean;
  isLastOwner?: boolean;
}

export function FormGeneral({
  defaultValues,
  onSubmit,
  disabled: externalDisabled,
  isLastOwner,
}: FormGeneralProps) {
  const [isPending, startTransition] = useTransition();
  const disabled = externalDisabled ?? isPending;

  const form = useForm({
    defaultValues: {
      role: defaultValues.role,
      isActive: defaultValues.isActive,
      departmentIds: defaultValues.departmentIds,
    },
    onSubmit: ({ value }) => {
      if (disabled) return;

      startTransition(async () => {
        try {
          const promise = onSubmit(value);

          toast.promise(promise, {
            loading: "Salvando...",
            success: () => "Membro salvo com sucesso",
            error: (error) => {
              if (isTRPCClientError(error)) {
                return error.message;
              }
              return "Falha ao salvar membro";
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
            Configure o nível de acesso e status do membro.
          </FormCardDescription>
        </FormCardHeader>
        <FormCardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={defaultValues.email}
              disabled
            />
          </div>

          <div className="flex flex-wrap justify-between gap-4">
            <form.Field name="role">
              {(field) => (
                <div className="flex items-center gap-2">
                  <Label htmlFor={field.name}>Nível de acesso</Label>
                  <Select
                    value={field.state.value}
                    onValueChange={(value) => {
                      field.handleChange(value as FormValues["role"]);
                    }}
                    disabled={disabled}
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
                      {(
                        Object.keys(roleLabels) as (keyof typeof roleLabels)[]
                      ).map((role) => {
                        const Icon = roleIcons[role];
                        const isDisabled = isLastOwner && role !== "owner";
                        return (
                          <SelectItem
                            key={role}
                            value={role}
                            className="py-3"
                            disabled={isDisabled}
                          >
                            <div className="flex items-start gap-2 sm:gap-3">
                              <Icon className="mt-0.5 h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                              <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                                <span className="font-medium text-sm">
                                  {roleLabels[role]}
                                </span>
                                <span className="text-xs text-muted-foreground leading-relaxed">
                                  {roleDescriptions[role]}
                                </span>
                              </div>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </form.Field>

            <form.Field name="isActive">
              {(field) => (
                <div className="flex items-center gap-2">
                  <Label htmlFor={field.name}>Ativo</Label>
                  <Switch
                    id={field.name}
                    checked={field.state.value}
                    onCheckedChange={field.handleChange}
                    disabled={disabled}
                  />
                </div>
              )}
            </form.Field>
          </div>
        </FormCardContent>

        <FormCardSeparator />

        <FormCardContent>
          <form.Field name="departmentIds">
            {(field) => (
              <div className="grid gap-2">
                <Label>Acesso aos departamentos</Label>
                <DepartmentSelector
                  value={field.state.value}
                  onChange={field.handleChange}
                  disabled={disabled}
                />
              </div>
            )}
          </form.Field>
        </FormCardContent>

        <FormCardFooter>
          <Button type="submit" size="sm" disabled={disabled}>
            {disabled ? "Salvando..." : "Salvar"}
          </Button>
        </FormCardFooter>
      </FormCard>
    </form>
  );
}
