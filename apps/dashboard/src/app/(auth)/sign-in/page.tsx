import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { SearchParams } from "nuqs";

import { auth } from "~/lib/auth/server";
import { SignInView } from "~/components/auth/sign-in-view";
import { searchParamsCache } from "./search-params";

export default async function Page(props: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (session) {
    redirect("/");
  }

  const { callbackURL } = await searchParamsCache.parse(props.searchParams);

  return <SignInView callbackURL={callbackURL} />;
}
