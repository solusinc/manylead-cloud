"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Actions, Subjects } from "@manylead/permissions";
import { usePermissions } from "~/lib/permissions";

interface PermissionGuardProps {
  children: React.ReactNode;
  action: Actions;
  subject: Subjects;
  fallbackUrl?: string;
}

/**
 * Client-side permission guard
 * Redirects user if they don't have the required permission
 */
export function PermissionGuard({
  children,
  action,
  subject,
  fallbackUrl = "/settings",
}: PermissionGuardProps) {
  const { can } = usePermissions();
  const router = useRouter();

  useEffect(() => {
    if (!can(action, subject)) {
      router.push(fallbackUrl);
    }
  }, [can, action, subject, fallbackUrl, router]);

  // Se não tem permissão, não renderiza nada (vai redirecionar)
  if (!can(action, subject)) {
    return null;
  }

  return <>{children}</>;
}
