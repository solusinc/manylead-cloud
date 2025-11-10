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
import { CreateOrgButton } from "./create-org-button";

const settings = [
  {
    title: "Geral",
    description: "Gerencie as configurações da sua organização.",
    href: "/settings/general",
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
        <div className="mb-4">
          <CreateOrgButton />
        </div>
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
