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

const settings = [
  {
    title: "Geral",
    description: "Gerencie as configurações da sua organização.",
    href: "/settings/general",
  },
  {
    title: "Conta",
    description: "Gerencie suas informações pessoais e preferências.",
    href: "/settings/account",
  },
  {
    title: "Departamentos",
    description:
      "Organize sua equipe em setores e otimize a distribuição de conversas.",
    href: "/settings/departments",
  },
  {
    title: "Atendentes",
    description:
      "Gerencie sua equipe de atendimento e organize o relacionamento com seus clientes.",
    href: "/settings/agents",
  },
  {
    title: "Criar Organização",
    description: "Crie uma nova organização e comece a gerenciar sua equipe.",
    href: "/settings/new-organization",
  },
];

export default function Page() {
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
          {settings.map((setting) => (
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
