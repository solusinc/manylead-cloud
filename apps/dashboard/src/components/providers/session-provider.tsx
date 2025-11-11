"use client";

import { createContext, useContext } from "react";
import type { ReactNode } from "react";

import type { auth } from "~/lib/auth/server";

type Session = Awaited<ReturnType<typeof auth.api.getSession>>;

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({
  children,
  session,
}: {
  children: ReactNode;
  session: Session;
}) {
  return (
    <SessionContext.Provider value={session}>
      {children}
    </SessionContext.Provider>
  );
}

export function useServerSession() {
  const context = useContext(SessionContext);
  if (context === null) {
    throw new Error("useServerSession must be used within SessionProvider");
  }
  return context;
}
