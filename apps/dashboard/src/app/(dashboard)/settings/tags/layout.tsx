import { PermissionGuard } from "~/components/guards/permission-guard";

export default function TagsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PermissionGuard action="manage" subject="Tag">
      {children}
    </PermissionGuard>
  );
}
