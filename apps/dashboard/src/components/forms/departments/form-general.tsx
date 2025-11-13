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

const dayScheduleSchema = z.object({
  start: z.string(),
  end: z.string(),
  enabled: z.boolean(),
});

const schema = z.object({
  name: z
    .string()
    .min(1, "Nome é obrigatório")
    .max(100, "Nome deve ter no máximo 100 caracteres"),
  workingHours: z
    .object({
      enabled: z.boolean(),
      timezone: z.string(),
      schedule: z.record(z.string(), dayScheduleSchema),
    })
    .optional(),
});

type FormValues = z.infer<typeof schema>;

const TIMEZONES = [
  { value: "America/Sao_Paulo", label: "São Paulo (BRT)" },
  { value: "America/New_York", label: "New York (EST)" },
  { value: "America/Los_Angeles", label: "Los Angeles (PST)" },
  { value: "Europe/London", label: "London (GMT)" },
  { value: "Europe/Paris", label: "Paris (CET)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "UTC", label: "UTC" },
];

const DAYS = [
  { key: "monday" as const, label: "Segunda-feira" },
  { key: "tuesday" as const, label: "Terça-feira" },
  { key: "wednesday" as const, label: "Quarta-feira" },
  { key: "thursday" as const, label: "Quinta-feira" },
  { key: "friday" as const, label: "Sexta-feira" },
  { key: "saturday" as const, label: "Sábado" },
  { key: "sunday" as const, label: "Domingo" },
] as const;

const DEFAULT_SCHEDULE = {
  monday: { start: "09:00", end: "18:00", enabled: true },
  tuesday: { start: "09:00", end: "18:00", enabled: true },
  wednesday: { start: "09:00", end: "18:00", enabled: true },
  thursday: { start: "09:00", end: "18:00", enabled: true },
  friday: { start: "09:00", end: "18:00", enabled: true },
  saturday: { start: "09:00", end: "13:00", enabled: false },
  sunday: { start: "09:00", end: "13:00", enabled: false },
};

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
      workingHours: defaultValues?.workingHours ?? {
        enabled: false,
        timezone: "America/Sao_Paulo",
        schedule: DEFAULT_SCHEDULE,
      },
    },
    onSubmit: ({ value }) => {
      if (isPending) return;

      startTransition(async () => {
        try {
          const promise = onSubmitAction(value);
          toast.promise(promise, {
            loading: "Salvando...",
            success: () => "Departamento salvo com sucesso",
            error: (error) => {
              if (isTRPCClientError(error)) {
                return error.message;
              }
              return "Falha ao salvar departamento";
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
            Configure as informações básicas do departamento.
          </FormCardDescription>
        </FormCardHeader>
        <FormCardSeparator />
        <FormCardContent>
          <div className="grid gap-4">
            <form.Field
              name="name"
              validators={{
                onChange: ({ value }) => {
                  const result = schema.shape.name.safeParse(value);
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
                  <Label htmlFor={field.name}>Nome</Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Ex: Suporte Técnico"
                  />
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

        <FormCardSeparator />
        <FormCardContent>
          <form.Field name="workingHours.enabled">
            {(field) => (
              <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor={field.name}>Ativar horário de funcionamento</Label>
                  <p className="text-muted-foreground text-sm">
                    Quando ativado, o departamento só aceitará conversas nos horários configurados.
                  </p>
                </div>
                <Switch
                  id={field.name}
                  checked={field.state.value}
                  onCheckedChange={field.handleChange}
                />
              </div>
            )}
          </form.Field>
        </FormCardContent>

        <form.Subscribe selector={(state) => state.values.workingHours.enabled}>
          {(enabled) =>
            enabled ? (
              <>
                <FormCardSeparator />
                <FormCardContent className="grid gap-4">
                  <form.Field name="workingHours.timezone">
                    {(field) => (
                      <div className="grid gap-2">
                        <Label htmlFor={field.name}>Fuso Horário</Label>
                        <Select value={field.state.value} onValueChange={field.handleChange}>
                          <SelectTrigger id={field.name}>
                            <SelectValue placeholder="Selecione o fuso horário" />
                          </SelectTrigger>
                          <SelectContent>
                            {TIMEZONES.map((tz) => (
                              <SelectItem key={tz.value} value={tz.value}>
                                {tz.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </form.Field>
                </FormCardContent>
                <FormCardSeparator />
                <FormCardContent className="grid gap-3">
                  <Label>Dias e Horários</Label>
                  {DAYS.map((day) => (
                    <div
                      key={day.key}
                      className="grid items-center gap-3 rounded-lg border p-3 sm:grid-cols-[200px_1fr]"
                    >
                      <form.Field name={`workingHours.schedule.${day.key}.enabled`}>
                        {(field) => (
                          <div className="flex items-center space-x-2">
                            <Switch
                              id={`${day.key}-enabled`}
                              checked={field.state.value}
                              onCheckedChange={field.handleChange}
                            />
                            <Label htmlFor={`${day.key}-enabled`} className="cursor-pointer font-normal">
                              {day.label}
                            </Label>
                          </div>
                        )}
                      </form.Field>
                      <form.Subscribe
                        selector={(state) => state.values.workingHours.schedule[day.key].enabled}
                      >
                        {(dayEnabled) =>
                          dayEnabled ? (
                            <div className="flex items-center gap-2">
                              <form.Field name={`workingHours.schedule.${day.key}.start`}>
                                {(field) => (
                                  <Input
                                    type="time"
                                    value={field.state.value}
                                    onChange={(e) => field.handleChange(e.target.value)}
                                    className="w-[120px] scheme-light dark:scheme-dark"
                                  />
                                )}
                              </form.Field>
                              <span className="text-muted-foreground text-sm">até</span>
                              <form.Field name={`workingHours.schedule.${day.key}.end`}>
                                {(field) => (
                                  <Input
                                    type="time"
                                    value={field.state.value}
                                    onChange={(e) => field.handleChange(e.target.value)}
                                    className="w-[120px] scheme-light dark:scheme-dark"
                                  />
                                )}
                              </form.Field>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">Desativado</span>
                          )
                        }
                      </form.Subscribe>
                    </div>
                  ))}
                </FormCardContent>
              </>
            ) : null
          }
        </form.Subscribe>

        <FormCardFooter>
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? "Salvando..." : "Salvar"}
          </Button>
        </FormCardFooter>
      </FormCard>
    </form>
  );
}
