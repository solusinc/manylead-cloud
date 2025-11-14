"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
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
import { useTRPC } from "~/lib/trpc/react";

interface FormValues {
  role: "owner" | "admin" | "member";
  restrictDepartments: boolean;
  departmentIds: string[];
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

export function FormInvitationUpdate() {
  const { id } = useParams<{ id: string }>();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const { data: invitation } = useQuery(trpc.invitation.getById.queryOptions({ id }));

  const updateMutation = useMutation(
    trpc.invitation.update.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.invitation.list.queryKey(),
        });
        void queryClient.invalidateQueries({
          queryKey: trpc.invitation.getById.queryKey({ id }),
        });
        router.push("/settings/users");
      },
    }),
  );

  const metadata = invitation?.metadata as
    | {
        departmentAccess?: "all" | "specific";
        departmentIds?: string[];
      }
    | null
    | undefined;

  const form = useForm({
    defaultValues: {
      role: (invitation?.role ?? "member") as FormValues["role"],
      restrictDepartments: metadata?.departmentAccess === "specific",
      departmentIds: metadata?.departmentIds ?? [],
    },
    onSubmit: ({ value }) => {
      if (isPending) return;

      startTransition(async () => {
        try {
          const departmentAccess = value.restrictDepartments ? "specific" : "all";

          const promise = updateMutation.mutateAsync({
            id,
            role: value.role,
            departmentAccess,
            departmentIds: value.restrictDepartments ? value.departmentIds : undefined,
          });

          toast.promise(promise, {
            loading: "Salvando...",
            success: () => "Convite atualizado com sucesso",
            error: (error) => {
              if (isTRPCClientError(error)) {
                return error.message;
              }
              return "Falha ao atualizar convite";
            },
          });

          await promise;
        } catch (error) {
          console.error(error);
        }
      });
    },
  });

  if (!invitation) return null;

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
            <FormCardTitle>Informações do convite</FormCardTitle>
            <FormCardDescription>
              Configure as informações do convite que será editado.
            </FormCardDescription>
          </FormCardHeader>
          <FormCardContent className="pb-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="email">Email do usuário</Label>
                <Input
                  id="email"
                  type="email"
                  value={invitation.email}
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
                      disabled={isPending}
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
                          return (
                            <SelectItem
                              key={role}
                              value={role}
                              className="py-3"
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
            <form.Field name="restrictDepartments">
              {(field) => (
                <>
                  <div className="flex items-center gap-2">
                    <Switch
                      id={field.name}
                      checked={field.state.value}
                      onCheckedChange={field.handleChange}
                      disabled={isPending}
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
                                disabled={isPending}
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
          </FormCardContent>
          <FormCardFooter>
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </FormCardFooter>
        </FormCard>
      </FormCardGroup>
    </form>
  );
}
