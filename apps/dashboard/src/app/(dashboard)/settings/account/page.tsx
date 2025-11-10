"use client";

import {
  Section,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "~/components/content/section";
import {
  FormCardDescription,
  FormCardFooterInfo,
  FormCardHeader,
  FormCardTitle,
  FormCardUpgrade,
} from "~/components/forms/form-card";
import {
  FormCard,
  FormCardContent,
  FormCardFooter,
} from "~/components/forms/form-card";
import { ThemeToggle } from "~/components/theme-toggle";
import { Input } from "@manylead/ui/input";
import { Label } from "@manylead/ui/label";
import { useSession } from "~/lib/auth/client";

export default function Page() {
  const { data: session } = useSession();

  if (!session?.user) return null;

  const user = session.user;

  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>Conta</SectionTitle>
        </SectionHeader>
        <FormCard>
          <FormCardUpgrade />
          <FormCardHeader>
            <FormCardTitle>Informações Pessoais</FormCardTitle>
            <FormCardDescription>
              Gerencie suas informações pessoais.
            </FormCardDescription>
          </FormCardHeader>
          <FormCardContent>
            <form className="grid gap-4">
              <div className="grid gap-1.5">
                <Label>Nome</Label>
                <Input defaultValue={user.name} disabled />
              </div>
              <div className="grid gap-1.5">
                <Label>Email</Label>
                <Input defaultValue={user.email} disabled />
              </div>
            </form>
          </FormCardContent>
          <FormCardFooter className="[&>:last-child]:ml-0">
            <FormCardFooterInfo>
              Entre em contato conosco se desejar alterar seu email ou nome.
            </FormCardFooterInfo>
          </FormCardFooter>
        </FormCard>
        <FormCard>
          <FormCardHeader>
            <FormCardTitle>Aparência</FormCardTitle>
            <FormCardDescription>
              Escolha seu tema preferido.
            </FormCardDescription>
          </FormCardHeader>
          <FormCardContent className="pb-4">
            <ThemeToggle />
          </FormCardContent>
        </FormCard>
      </Section>
    </SectionGroup>
  );
}
