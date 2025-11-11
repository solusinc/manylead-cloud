"use client";

import {
  ActionCard,
  ActionCardDescription,
  ActionCardGroup,
  ActionCardHeader,
  ActionCardTitle,
} from "~/components/content/action-card";
import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "~/components/content/section";
import Link from "next/link";
import { usePermissions } from "~/lib/permissions";
import type { Actions, Subjects } from "@manylead/permissions";

const settings = [
  {
    title: "Geral",
    description: "Gerencie as configurações da sua organização.",
    href: "/settings/general",
    permission: { action: "manage" as Actions, subject: "Organization" as Subjects },
  },
  {
    title: "Conta",
    description: "Gerencie suas informações pessoais e preferências.",
    href: "/settings/account",
    permission: null, // Todos podem ver
  },
  {
    title: "Departamentos",
    description:
      "Organize sua equipe em setores e otimize a distribuição de conversas.",
    href: "/settings/departments",
    permission: { action: "manage" as Actions, subject: "Department" as Subjects },
  },
  {
    title: "Membros",
    description:
      "Gerencie os membros da sua equipe e organize o relacionamento com seus clientes.",
    href: "/settings/agents",
    permission: { action: "manage" as Actions, subject: "Agent" as Subjects },
  },
  {
    title: "Criar Organização",
    description: "Crie uma nova organização e comece a gerenciar sua equipe.",
    href: "/settings/new-organization",
    permission: { action: "create" as Actions, subject: "Organization" as Subjects },
  },
];

export default function Page() {
  const { can } = usePermissions();

  // Filtrar settings baseado em permissões
  const visibleSettings = settings.filter((setting) => {
    if (!setting.permission) return true; // Sem permissão = todos veem
    return can(setting.permission.action, setting.permission.subject);
  });

  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>Configurações</SectionTitle>
          <SectionDescription>
            Todas as suas configurações em um só lugar.
          </SectionDescription>
        </SectionHeader>
        <ActionCardGroup>
          {visibleSettings.map((setting) => (
            <Link href={setting.href} key={setting.href}>
              <ActionCard className="h-full w-full">
                <ActionCardHeader>
                  <ActionCardTitle>{setting.title}</ActionCardTitle>
                  <ActionCardDescription>
                    {setting.description}
                  </ActionCardDescription>
                </ActionCardHeader>
              </ActionCard>
            </Link>
          ))}
        </ActionCardGroup>
      </Section>
    </SectionGroup>
  );
}
