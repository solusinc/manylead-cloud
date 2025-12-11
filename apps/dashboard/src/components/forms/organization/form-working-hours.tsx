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

const TIMEZONES = [
  // Brasil
  { value: "America/Noronha", label: "Fernando de Noronha (FNT) GMT-2" },
  { value: "America/Sao_Paulo", label: "Brasília (BRT) GMT-3" },
  { value: "America/Manaus", label: "Amazon (AMT) GMT-4" },
  { value: "America/Rio_Branco", label: "Acre (ACT) GMT-5" },

  // Américas
  { value: "Pacific/Honolulu", label: "Hawaii-Aleutian (HAST) GMT-10" },
  { value: "Pacific/Pago_Pago", label: "Samoa (SST) GMT-11" },
  { value: "America/Anchorage", label: "Alaska (AKST) GMT-9" },
  { value: "America/Los_Angeles", label: "Pacific (PST) GMT-8" },
  { value: "America/Denver", label: "Mountain (MST) GMT-7" },
  { value: "America/Chicago", label: "Central (CST) GMT-6" },
  { value: "America/New_York", label: "Eastern (EST) GMT-5" },
  { value: "America/Argentina/Buenos_Aires", label: "Argentina (ART) GMT-3" },
  { value: "America/Santiago", label: "Chile (CLT) GMT-4" },
  { value: "America/Bogota", label: "Colombia (COT) GMT-5" },
  { value: "America/Lima", label: "Peru (PET) GMT-5" },

  // Europa e África
  { value: "America/Scoresbysund", label: "Eastern Greenland (EGT) GMT-1" },
  { value: "Europe/London", label: "Greenwich Mean Time (GMT) GMT+0" },
  { value: "Europe/Paris", label: "Central European (CET) GMT+1" },
  { value: "Europe/Helsinki", label: "Eastern European (EET) GMT+2" },
  { value: "Europe/Moscow", label: "Moscow (MSK) GMT+3" },
  { value: "Europe/Istanbul", label: "Turkey (TRT) GMT+3" },
  { value: "Africa/Johannesburg", label: "South Africa (SAST) GMT+2" },

  // Ásia e Oceania
  { value: "Asia/Dubai", label: "Gulf (GST) GMT+4" },
  { value: "Asia/Karachi", label: "Pakistan (PKT) GMT+5" },
  { value: "Asia/Kolkata", label: "India (IST) GMT+5:30" },
  { value: "Asia/Dhaka", label: "Bangladesh (BST) GMT+6" },
  { value: "Asia/Bangkok", label: "Indochina (ICT) GMT+7" },
  { value: "Asia/Shanghai", label: "China (CST) GMT+8" },
  { value: "Asia/Tokyo", label: "Japan (JST) GMT+9" },
  { value: "Asia/Seoul", label: "Korea (KST) GMT+9" },
  { value: "Australia/Sydney", label: "Australian Eastern (AEST) GMT+10" },
  { value: "Australia/Perth", label: "Australian Western (AWST) GMT+8" },
  { value: "Pacific/Noumea", label: "New Caledonia (NCT) GMT+11" },
  { value: "Pacific/Auckland", label: "New Zealand (NZST) GMT+12" },
];

const dayScheduleSchema = z
  .object({
    start: z.string(),
    end: z.string(),
    enabled: z.boolean(),
  })
  .refine(
    (data) => {
      if (!data.enabled) return true;

      // Validar que o horário final não ultrapasse 23:59
      const endParts = data.end.split(":").map(Number);
      const endHours = endParts[0];
      const endMinutes = endParts[1];

      if (endHours === undefined || endMinutes === undefined) return false;
      if (endHours > 23 || (endHours === 23 && endMinutes > 59)) {
        return false;
      }

      // Validar que o horário final seja maior que o inicial
      const startParts = data.start.split(":").map(Number);
      const startHours = startParts[0];
      const startMinutes = startParts[1];

      if (startHours === undefined || startMinutes === undefined) return false;

      const startTotalMinutes = startHours * 60 + startMinutes;
      const endTotalMinutes = endHours * 60 + endMinutes;

      return endTotalMinutes > startTotalMinutes;
    },
    {
      message: "O horário final deve ser maior que o inicial e não pode ultrapassar 23:59",
    }
  );

const _schema = z.object({
  timezone: z.string().min(1, "Fuso horário é obrigatório"),
  workingHours: z.object({
    enabled: z.boolean(),
    schedule: z.record(z.string(), dayScheduleSchema),
  }),
});

type FormValues = z.infer<typeof _schema>;

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

export function FormWorkingHours({
  onSubmitAction,
  defaultValues,
}: {
  onSubmitAction: (values: FormValues) => Promise<void>;
  defaultValues?: Partial<FormValues>;
}) {
  const [isPending, startTransition] = useTransition();

  const form = useForm({
    defaultValues: {
      timezone: defaultValues?.timezone ?? "America/Sao_Paulo",
      workingHours: defaultValues?.workingHours ?? {
        enabled: false,
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
            success: () => "Configurações salvas com sucesso",
            error: (error) => {
              if (isTRPCClientError(error)) {
                return error.message;
              }
              return "Falha ao salvar configurações";
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
          <FormCardTitle>Horário de atendimento</FormCardTitle>
          <FormCardDescription>
            Configure o fuso horário padrão e os horários em que sua organização
            está disponível.
          </FormCardDescription>
        </FormCardHeader>
        <FormCardSeparator />
        <FormCardContent className="grid gap-4">
          <form.Field name="timezone">
            {(field) => (
              <div className="grid gap-2">
                <Label htmlFor={field.name}>Fuso horário</Label>
                <Select
                  value={field.state.value}
                  onValueChange={field.handleChange}
                >
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

          <form.Field name="workingHours.enabled">
            {(field) => (
              <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor={field.name}>
                    Ativar horário de funcionamento
                  </Label>
                  <p className="text-muted-foreground text-sm">
                    Quando ativado, o sistema utilizará os horários configurados
                    abaixo.
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
                <FormCardContent className="grid gap-3">
                  <Label>Dias e horários</Label>
                  {DAYS.map((day) => (
                    <div
                      key={day.key}
                      className="grid items-center gap-3 rounded-lg border p-3 sm:grid-cols-[200px_1fr]"
                    >
                      <form.Field
                        name={`workingHours.schedule.${day.key}.enabled`}
                      >
                        {(field) => (
                          <div className="flex items-center space-x-2">
                            <Switch
                              id={`${day.key}-enabled`}
                              checked={field.state.value}
                              onCheckedChange={field.handleChange}
                            />
                            <Label
                              htmlFor={`${day.key}-enabled`}
                              className="cursor-pointer font-normal"
                            >
                              {day.label}
                            </Label>
                          </div>
                        )}
                      </form.Field>
                      <form.Subscribe
                        selector={(state) =>
                          state.values.workingHours.schedule[day.key].enabled
                        }
                      >
                        {(dayEnabled) =>
                          dayEnabled ? (
                            <form.Field
                              name={`workingHours.schedule.${day.key}.end`}
                              validators={{
                                onChange: ({ value, fieldApi }) => {
                                  const endParts = value.split(":").map(Number);
                                  const endHours = endParts[0];
                                  const endMinutes = endParts[1];

                                  if (endHours === undefined || endMinutes === undefined) {
                                    return undefined;
                                  }

                                  // Validar máximo 23:59
                                  if (
                                    endHours > 23 ||
                                    (endHours === 23 && endMinutes > 59)
                                  ) {
                                    return "O horário final não pode ultrapassar 23:59";
                                  }

                                  const startField = String(
                                    fieldApi.form.getFieldValue(
                                      `workingHours.schedule.${day.key}.start`
                                    )
                                  );
                                  const startParts = startField.split(":").map(Number);
                                  const startHours = startParts[0];
                                  const startMinutes = startParts[1];

                                  if (
                                    startHours === undefined ||
                                    startMinutes === undefined
                                  ) {
                                    return undefined;
                                  }

                                  const startTotal = startHours * 60 + startMinutes;
                                  const endTotal = endHours * 60 + endMinutes;

                                  if (endTotal <= startTotal) {
                                    return "O horário final deve ser maior que o inicial";
                                  }
                                },
                              }}
                            >
                              {(endField) => (
                                <div className="grid gap-1">
                                  <div className="flex items-center gap-2">
                                    <form.Field
                                      name={`workingHours.schedule.${day.key}.start`}
                                      validators={{
                                        onChange: ({ value, fieldApi }) => {
                                          const endFieldValue = String(
                                            fieldApi.form.getFieldValue(
                                              `workingHours.schedule.${day.key}.end`
                                            )
                                          );

                                          const startParts = value.split(":").map(Number);
                                          const endParts = endFieldValue.split(":").map(Number);

                                          const startHours = startParts[0];
                                          const startMinutes = startParts[1];
                                          const endHours = endParts[0];
                                          const endMinutes = endParts[1];

                                          if (
                                            startHours === undefined ||
                                            startMinutes === undefined ||
                                            endHours === undefined ||
                                            endMinutes === undefined
                                          ) {
                                            return undefined;
                                          }

                                          const startTotal = startHours * 60 + startMinutes;
                                          const endTotal = endHours * 60 + endMinutes;

                                          if (endTotal <= startTotal) {
                                            return "O horário final deve ser maior que o inicial";
                                          }
                                        },
                                      }}
                                    >
                                      {(startField) => (
                                        <Input
                                          type="time"
                                          value={startField.state.value}
                                          onChange={(e) =>
                                            startField.handleChange(e.target.value)
                                          }
                                          className="w-[120px] scheme-light dark:scheme-dark"
                                        />
                                      )}
                                    </form.Field>
                                    <span className="text-muted-foreground text-sm">
                                      até
                                    </span>
                                    <Input
                                      type="time"
                                      value={endField.state.value}
                                      onChange={(e) =>
                                        endField.handleChange(e.target.value)
                                      }
                                      className="w-[120px] scheme-light dark:scheme-dark"
                                    />
                                  </div>
                                  {endField.state.meta.errors.length > 0 && (
                                    <p className="text-destructive text-xs">
                                      {endField.state.meta.errors[0]}
                                    </p>
                                  )}
                                </div>
                              )}
                            </form.Field>
                          ) : (
                            <span className="text-muted-foreground text-sm">
                              Desativado
                            </span>
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
