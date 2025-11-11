import { PermissionGuard } from "~/components/guards/permission-guard";

export default function AgentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PermissionGuard action="manage" subject="Agent">
      {children}
    </PermissionGuard>
  );
}
