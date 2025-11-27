import { PermissionGuard } from "~/components/guards/permission-guard";

export default function EndingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PermissionGuard action="manage" subject="Ending">
      {children}
    </PermissionGuard>
  );
}
