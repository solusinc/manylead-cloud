import { redirect } from "next/navigation";

import { auth } from "~/lib/auth/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await import("next/headers").then((mod) => mod.headers()),
  });

  if (!session) {
    redirect("/login");
  }

  return <>{children}</>;
}
