import { HydrateClient, getQueryClient, trpc } from "~/lib/trpc/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { SearchParams } from "nuqs";
import { Client } from "./client";
import { searchParamsCache } from "./search-params";
import { auth } from "~/lib/auth/server";

export default async function InvitePage(props: {
  searchParams: Promise<SearchParams>;
}) {
  const headersList = await headers();
  const session = await auth.api.getSession({
    headers: headersList,
  });

  const { token } = await searchParamsCache.parse(props.searchParams);

  if (!session) {
    // Preserve the invite token in the callback URL
    const pathname = headersList.get("x-pathname") ?? "/invite";
    const searchParams = headersList.get("x-search-params") ?? "";
    const fullPath = searchParams ? `${pathname}?${searchParams}` : pathname;
    const callbackURL = encodeURIComponent(fullPath);
    redirect(`/sign-in?callbackURL=${callbackURL}`);
  }

  if (!token) {
    return redirect("/overview");
  }

  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(trpc.invitation.get.queryOptions({ token }));

  return (
    <HydrateClient>
      <Client />
    </HydrateClient>
  );
}
