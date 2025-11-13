import { HydrateClient } from "~/lib/trpc/server";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <HydrateClient>{children}</HydrateClient>;
}
