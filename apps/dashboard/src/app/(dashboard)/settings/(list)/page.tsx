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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {settings.map((setting) => (
            <Link href={setting.href} key={setting.href}>
              <div className="h-full w-full rounded-lg border bg-card p-6 hover:bg-accent">
                <h3 className="mb-2 font-semibold">{setting.title}</h3>
                <p className="text-muted-foreground text-sm">
                  {setting.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </Section>
    </SectionGroup>
  );
}
