"use client";

import Link from "next/link";
import { Building, MessageSquare, SlidersVertical, User, Users } from "lucide-react";

import type { Actions, Subjects } from "@manylead/permissions";

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
import { usePermissions } from "~/lib/permissions";

const settings = [
  {
    title: "Ajustes gerais",
    description:
      "Gerencie as configurações da sua organização, mensagens, regras de utilização, horário de atendimento e mais.",
    href: "/settings/general",
    icon: SlidersVertical,
    permission: {
      action: "manage" as Actions,
      subject: "Organization" as Subjects,
    },
  },
  {
    title: "Conta",
    description: "Gerencie suas informações pessoais e preferências.",
    href: "/settings/account",
    icon: User,
    permission: null, // Todos podem ver
  },
  {
    title: "Departamentos",
    description:
      "Organize sua equipe em setores e otimize a distribuição de conversas.",
    href: "/settings/departments",
    icon: Building,
    permission: {
      action: "manage" as Actions,
      subject: "Department" as Subjects,
    },
  },
  {
    title: "Canais",
    description:
      "Conecte e gerencie seus canais de atendimento via WhatsApp.",
    href: "/settings/channels",
    icon: MessageSquare,
    permission: {
      action: "manage" as Actions,
      subject: "Channel" as Subjects,
    },
  },
  {
    title: "Usuários",
    description:
      "Adicione usuários à sua conta, defina permissões de acesso e acompanhe quem está online.",
    href: "/settings/users",
    icon: Users,
    permission: { action: "manage" as Actions, subject: "Agent" as Subjects },
  },
  // Temporarily hidden - user creation of organizations disabled
  // {
  //   title: "Criar Organização",
  //   description: "Crie uma nova organização e comece a gerenciar sua equipe.",
  //   href: "/settings/new-organization",
  //   permission: { action: "create" as Actions, subject: "Organization" as Subjects },
  // },
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
          {visibleSettings.map((setting) => {
            const Icon = setting.icon;
            return (
              <Link href={setting.href} key={setting.href}>
                <ActionCard className="hover:bg-accent h-full w-full transition-colors">
                  <ActionCardHeader>
                    <div className="flex gap-3">
                      <div className="flex items-center justify-center">
                        <Icon className="text-muted-foreground h-5 w-5 shrink-0" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <ActionCardTitle>{setting.title}</ActionCardTitle>
                        <ActionCardDescription>
                          {setting.description}
                        </ActionCardDescription>
                      </div>
                    </div>
                  </ActionCardHeader>
                </ActionCard>
              </Link>
            );
          })}
        </ActionCardGroup>
      </Section>
    </SectionGroup>
  );
}
