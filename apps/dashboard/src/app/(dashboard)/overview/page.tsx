import {
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "~/components/content/section";

import { Note, NoteButton } from "~/components/common/note";
import {
  EmptyStateContainer,
  EmptyStateTitle,
} from "~/components/content/empty-state";
import { Section } from "~/components/content/section";
import {
  MetricCard,
  MetricCardGroup,
  MetricCardHeader,
  MetricCardTitle,
  MetricCardValue,
} from "~/components/metric/metric-card";
import { List, Search, Terminal } from "lucide-react";
import Link from "next/link";
import { TestMessageButton } from "./_components/test-message-button";

export default function OverviewPage() {
  // TODO: Implement TRPC queries
  // const queryClient = getQueryClient();
  // const contacts = await queryClient.fetchQuery(trpc.contact.list.queryOptions());
  // const conversations = await queryClient.fetchQuery(trpc.conversation.list.queryOptions());
  // etc...

  const metrics = [
    {
      title: "Contacts",
      value: 0,
      href: "/contacts",
      variant: "default" as const,
      icon: List,
    },
    {
      title: "Conversations",
      value: 0,
      href: "/conversations",
      variant: "default" as const,
      icon: List,
    },
    {
      title: "Active Campaigns",
      value: 0,
      disabled: true,
      href: "/campaigns",
      variant: "default" as const,
      icon: Search,
    },
    {
      title: "Leads Generated",
      value: 0,
      disabled: true,
      href: "/leads",
      variant: "default" as const,
      icon: Search,
    },
    {
      title: "Conversion Rate",
      value: "0%",
      disabled: true,
      href: "/analytics",
      variant: "default" as const,
      icon: Search,
    },
  ];

  return (
    <SectionGroup>
      <Note>
        <Terminal />
        Use our API to manage your contacts and conversations programmatically.
        <NoteButton variant="outline" asChild>
          <Link href="/settings/api">Learn more</Link>
        </NoteButton>
      </Note>
      <Section>
        <SectionHeader>
          <SectionTitle>WhatsApp Test</SectionTitle>
          <SectionDescription>
            Envie uma mensagem de teste para +5521984848843
          </SectionDescription>
        </SectionHeader>
        <TestMessageButton />
      </Section>
      <Section>
        <SectionHeader>
          <SectionTitle>Overview</SectionTitle>
          <SectionDescription>
            Welcome to your ManyLead dashboard.
          </SectionDescription>
        </SectionHeader>
        <MetricCardGroup>
          {metrics.map((metric) => (
            <Link
              href={metric.href}
              key={metric.title}
              className={metric.disabled ? "pointer-events-none" : ""}
              aria-disabled={metric.disabled}
            >
              <MetricCard variant={metric.variant}>
                <MetricCardHeader className="flex items-center justify-between gap-2">
                  <MetricCardTitle className="truncate">
                    {metric.title}
                  </MetricCardTitle>
                  <metric.icon className="size-4" />
                </MetricCardHeader>
                <MetricCardValue>{metric.value}</MetricCardValue>
              </MetricCard>
            </Link>
          ))}
        </MetricCardGroup>
      </Section>
      <Section>
        <SectionHeader>
          <SectionTitle>Recent Contacts</SectionTitle>
          <SectionDescription>
            Your most recent contacts.
          </SectionDescription>
        </SectionHeader>
        <EmptyStateContainer>
          <EmptyStateTitle>No contacts found</EmptyStateTitle>
        </EmptyStateContainer>
      </Section>
      <Section>
        <SectionHeader>
          <SectionTitle>Recent Conversations</SectionTitle>
          <SectionDescription>
            Your most recent conversations.
          </SectionDescription>
        </SectionHeader>
        <EmptyStateContainer>
          <EmptyStateTitle>No conversations found</EmptyStateTitle>
        </EmptyStateContainer>
      </Section>
      <Section>
        <SectionHeader>
          <SectionTitle>Active Campaigns</SectionTitle>
          <SectionDescription>
            Your currently active campaigns.
          </SectionDescription>
        </SectionHeader>
        <EmptyStateContainer>
          <EmptyStateTitle>No campaigns found</EmptyStateTitle>
        </EmptyStateContainer>
      </Section>
    </SectionGroup>
  );
}
