import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "~/lib/auth/server";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (session) redirect("/");

  return (
    <div className="grid min-h-screen grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
      <aside className="border-border bg-sidebar col-span-1 flex w-full flex-col gap-4 border p-4 backdrop-blur-[2px] md:p-8 xl:col-span-2">
        <a href="https://manylead.com" className="relative h-8 w-8">
          <div className="border-border bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-full border text-sm font-bold">
            ML
          </div>
        </a>
        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-8 text-center md:text-left">
          <div className="mx-auto grid gap-3">
            <h1 className="text-foreground text-3xl font-bold">
              All-in-one Lead Management Platform
            </h1>
            <p className="text-muted-foreground text-sm">
              Manage your leads, CRM, and customer relationships in one place.
              Built for teams that want to grow their business.
              <br />
              <br />
              Get started now with your free account!
            </p>
          </div>
        </div>
        <div className="md:h-8" />
      </aside>
      <main className="col-span-1 container mx-auto flex items-center justify-center md:col-span-1 xl:col-span-3">
        {children}
      </main>
    </div>
  );
}
