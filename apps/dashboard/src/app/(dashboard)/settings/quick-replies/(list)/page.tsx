import { HydrateClient, getQueryClient, trpc } from "~/lib/trpc/server";
import { Client } from "./client";

export default async function Page() {
  const queryClient = getQueryClient();

  await queryClient.prefetchQuery(trpc.quickReplies.listAdmin.queryOptions());

  return (
    <HydrateClient>
      <Client />
    </HydrateClient>
  );
}
