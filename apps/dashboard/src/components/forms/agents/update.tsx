"use client";

import { useTransition } from "react";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
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

export function FormAgentUpdate() {
  const { id } = useParams<{ id: string }>();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const { data: agent } = useQuery(trpc.agents.getById.queryOptions({ id }));
  const { data: allAgents = [] } = useQuery(trpc.agents.list.queryOptions());

  // Verificar se é o último proprietário
  const isLastOwner =
    agent?.role === "owner" &&
    allAgents.filter((a) => a.role === "owner").length === 1;

  const updateMutation = useMutation(
    trpc.agents.update.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.agents.list.queryKey(),
        });
        void queryClient.invalidateQueries({
          queryKey: trpc.agents.getById.queryKey({ id }),
        });
        router.push("/settings/agents");
      },
    }),
  );

  const form = useForm({
    defaultValues: {
      role: agent?.role ?? "member",
      isActive: agent?.isActive ?? true,
      departmentIds:
        agent?.permissions.departments.type === "specific"
          ? agent.permissions.departments.ids ?? []
          : [],
    },
    onSubmit: ({ value }) => {
      if (isPending || !agent) return;

      startTransition(async () => {
        try {
          const departmentAccess =
            value.departmentIds.length > 0 ? "specific" : "all";

          const promise = updateMutation.mutateAsync({
            id,
            data: {
              role: value.role,
              isActive: value.isActive,
              permissions: {
                ...agent.permissions,
                departments:
                  departmentAccess === "specific"
                    ? { type: "specific", ids: value.departmentIds }
                    : { type: "all" },
              },
            },
          });

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

  if (!agent) return null;

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
            <FormCardTitle>Informações Gerais</FormCardTitle>
            <FormCardDescription>
              Configure o nível de acesso e status do membro.
            </FormCardDescription>
          </FormCardHeader>
          <FormCardContent className="pb-6">
            <div className="grid gap-4">
              <div className="flex flex-wrap gap-4">
                <div className="grid flex-1 gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={agent.user?.email ?? ""}
                    disabled
                  />
                </div>

                <form.Field name="isActive">
                  {(field) => (
                    <div className="flex flex-row items-center gap-2 pt-5">
                      <Label htmlFor={field.name}>Ativo</Label>
                      <Switch
                        id={field.name}
                        checked={field.state.value}
                        onCheckedChange={field.handleChange}
                        disabled={isPending}
                      />
                    </div>
                  )}
                </form.Field>

                <form.Field name="role">
                {(field) => (
                  <div className="grid basis-full gap-2 sm:basis-auto">
                    <Label htmlFor={field.name}>Nível de acesso</Label>
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
              </div>
            </div>
          </FormCardContent>
        </FormCard>

        <FormCard>
          <FormCardHeader>
            <FormCardTitle>Acesso aos Departamentos</FormCardTitle>
            <FormCardDescription>
              Defina quais departamentos este membro poderá acessar.
            </FormCardDescription>
          </FormCardHeader>
          <FormCardContent>
            <form.Field name="departmentIds">
              {(field) => (
                <div className="grid gap-2">
                  <Label>Departamentos</Label>
                  <DepartmentSelector
                    value={field.state.value}
                    onChange={field.handleChange}
                    disabled={isPending}
                  />
                </div>
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
