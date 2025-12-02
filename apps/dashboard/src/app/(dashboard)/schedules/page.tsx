import type { SearchParams } from "nuqs";

import { getQueryClient, HydrateClient, trpc } from "~/lib/trpc/server";
import { Client } from "./client";
import { searchParamsCache } from "./search-params";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const queryClient = getQueryClient();
  const params = await searchParamsCache.parse(searchParams);

  // Prefetch scheduled messages
  await queryClient.prefetchQuery(
    trpc.scheduledMessages.listByOrganization.queryOptions({
      status: params.status ?? undefined,
      dateFrom: params.dateFrom ?? undefined,
      dateTo: params.dateTo ?? undefined,
      page: params.page,
      pageSize: 50,
    }),
  );

  return (
    <HydrateClient>
      <Client />
    </HydrateClient>
  );
}
