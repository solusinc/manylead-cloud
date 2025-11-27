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
  FormCardGroup,
  FormCardHeader,
  FormCardTitle,
} from "~/components/forms/form-card";
import { DepartmentSelector } from "./department-selector";

interface FormValues {
  role: "owner" | "admin" | "member";
  isActive: boolean;
  restrictDepartments: boolean;
  departmentIds: string[];
  canManageMessages: boolean;
  accessFinishedChats: boolean;
}

const roleLabels = {
  owner: "Administrador",
  admin: "Supervisor",
  member: "Agente",
} as const;

const roleDescriptions = {
  owner:
    "Acessa todas as conversas. Gerencia todas as configurações.",
  admin:
    "Acessa todas as conversas. Gerencia apenas \"contatos\" e \"respostas rápidas\"",
  member:
    "Acessa apenas suas próprias conversas.",
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
      restrictDepartments: defaultValues.restrictDepartments,
      departmentIds: defaultValues.departmentIds,
      canManageMessages: defaultValues.canManageMessages,
      accessFinishedChats: defaultValues.accessFinishedChats,
    },
    onSubmit: ({ value }) => {
      if (disabled) return;

      startTransition(async () => {
        try {
          const promise = onSubmit(value);

          toast.promise(promise, {
            loading: "Salvando...",
            success: () => "Usuário salvo com sucesso",
            error: (error) => {
              if (isTRPCClientError(error)) {
                return error.message;
              }
              return "Falha ao salvar usuário";
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
      <FormCardGroup>
        <FormCard>
          <FormCardHeader>
            <FormCardTitle>Informações do usuário</FormCardTitle>
            <FormCardDescription>
              Configure as informações do usuário que será editado.
            </FormCardDescription>
          </FormCardHeader>
          <FormCardContent className="pb-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="email">Email do usuário</Label>
                <Input
                  id="email"
                  type="email"
                  value={defaultValues.email}
                  disabled
                />
              </div>

              <form.Field name="role">
                {(field) => (
                  <div className="grid gap-2 sm:col-span-1">
                    <Label htmlFor={field.name}>Perfil de acesso</Label>
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
                      <SelectContent className="w-[calc(100vw-2rem)] max-w-[500px] sm:w-[--radix-select-trigger-width]">
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
                                <Icon className="mt-0.5 h-4 w-4 shrink-0 sm:h-5 sm:w-5" />
                                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                  <span className="text-sm font-medium">
                                    {roleLabels[role]}
                                  </span>
                                  <span className="text-muted-foreground text-xs leading-relaxed">
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
            </div>
          </FormCardContent>
        </FormCard>

        <FormCard>
          <FormCardHeader>
            <FormCardTitle>Permissões</FormCardTitle>
            <FormCardDescription>
              Defina o que este usuário pode visualizar, acessar e fazer no
              sistema.
            </FormCardDescription>
          </FormCardHeader>
          <FormCardContent className="grid gap-4">
            <form.Field name="isActive">
              {(field) => (
                <div className="flex items-center gap-2">
                  <Switch
                    id={field.name}
                    checked={field.state.value}
                    onCheckedChange={field.handleChange}
                    disabled={disabled}
                  />
                  <Label htmlFor={field.name} className="cursor-pointer font-normal">
                    Usuário ativo
                  </Label>
                </div>
              )}
            </form.Field>

            <form.Field name="restrictDepartments">
              {(field) => (
                <>
                  <div className="flex items-center gap-2">
                    <Switch
                      id={field.name}
                      checked={field.state.value}
                      onCheckedChange={field.handleChange}
                      disabled={disabled}
                    />
                    <Label htmlFor={field.name} className="cursor-pointer font-normal">
                      Restringir acesso a departamento
                    </Label>
                  </div>

                  <form.Subscribe selector={(state) => state.values.restrictDepartments}>
                    {(restrictDepartments) =>
                      restrictDepartments ? (
                        <form.Field name="departmentIds">
                          {(departmentField) => (
                            <div className="grid gap-2">
                              <Label>Departamentos permitidos</Label>
                              <DepartmentSelector
                                value={departmentField.state.value}
                                onChange={departmentField.handleChange}
                                disabled={disabled}
                              />
                            </div>
                          )}
                        </form.Field>
                      ) : null
                    }
                  </form.Subscribe>
                </>
              )}
            </form.Field>

            <form.Field name="canManageMessages">
              {(field) => (
                <div className="flex items-center gap-2">
                  <Switch
                    id={field.name}
                    checked={field.state.value}
                    onCheckedChange={field.handleChange}
                    disabled={disabled}
                  />
                  <Label htmlFor={field.name} className="cursor-pointer font-normal">
                    Permitir apagar e editar mensagens
                  </Label>
                </div>
              )}
            </form.Field>

            <form.Field name="accessFinishedChats">
              {(field) => (
                <div className="flex items-center gap-2">
                  <Switch
                    id={field.name}
                    checked={field.state.value}
                    onCheckedChange={field.handleChange}
                    disabled={disabled}
                  />
                  <Label htmlFor={field.name} className="cursor-pointer font-normal">
                    Permitir acesso a atendimentos finalizados
                  </Label>
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
      </FormCardGroup>
    </form>
  );
}
