"use client";

import { TabsContent, TabsList, TabsTrigger, Tabs, Button, Input, Label } from "@manylead/ui";

import {
  FormCard,
  FormCardContent,
  FormCardDescription,
  FormCardHeader,
  FormCardSeparator,
  FormCardTitle,
  FormCardUpgrade,
  FormCardFooter,
  FormCardFooterInfo,
} from "~/components/forms/form-card";

import { Lock } from "lucide-react";

import { DataTable as InvitationsDataTable } from "~/components/data-table/settings/invitations/data-table";
import { DataTable as MembersDataTable } from "~/components/data-table/settings/members/data-table";
import { useForm } from "@tanstack/react-form";
import { useTransition } from "react";
import { toast } from "sonner";
import { z } from "zod";

const schema = z.object({
  email: z.string().email("Email inválido"),
  role: z.enum(["member"]),
});

type FormValues = z.infer<typeof schema>;

export function FormMembers({
  locked,
  onCreate,
}: {
  locked?: boolean;
  onCreate: (values: FormValues) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();

  const form = useForm({
    defaultValues: {
      email: "",
      role: "member" as const,
    },
    onSubmit: ({ value }) => {
      if (isPending) return;

      startTransition(async () => {
        try {
          const promise = onCreate(value);
          toast.promise(promise, {
            loading: "Salvando...",
            success: () => "Salvo",
            error: "Falha ao salvar",
          });
          await promise;
          form.reset();
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
        {locked ? <FormCardUpgrade /> : null}
        <FormCardHeader>
          <FormCardTitle>Equipe</FormCardTitle>
          <FormCardDescription>
            Gerencie os membros da sua equipe.
          </FormCardDescription>
        </FormCardHeader>
        <FormCardContent>
          <Tabs defaultValue="members">
            <TabsList>
              <TabsTrigger value="members">Membros</TabsTrigger>
              <TabsTrigger value="pending">Pendentes</TabsTrigger>
            </TabsList>
            <TabsContent value="members">
              <MembersDataTable />
            </TabsContent>
            <TabsContent value="pending">
              <InvitationsDataTable />
            </TabsContent>
          </Tabs>
        </FormCardContent>
        <FormCardSeparator />
        <FormCardContent>
          <form.Field
            name="email"
            validators={{
              onChange: ({ value }) => {
                const result = schema.shape.email.safeParse(value);
                if (!result.success) {
                  return result.error.issues[0]?.message ?? "Erro de validação";
                }
                return undefined;
              },
            }}
          >
            {(field) => (
              <div className="grid gap-2">
                <Label htmlFor={field.name}>Adicionar membro</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  type="email"
                  placeholder="Email"
                  disabled={locked}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                {field.state.meta.errors.length > 0 ? (
                  <p className="text-destructive text-sm">
                    {field.state.meta.errors[0]}
                  </p>
                ) : null}
                <FormCardDescription>
                  Envie um convite para participar da equipe.
                </FormCardDescription>
              </div>
            )}
          </form.Field>
        </FormCardContent>
        <FormCardFooter>
          {locked ? (
            <>
              <FormCardFooterInfo>
                Este recurso está disponível no plano Pro.
              </FormCardFooterInfo>
              <Button type="button" size="sm">
                <Lock />
                Fazer Upgrade
              </Button>
            </>
          ) : (
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? "Enviando..." : "Enviar"}
            </Button>
          )}
        </FormCardFooter>
      </FormCard>
    </form>
  );
}
