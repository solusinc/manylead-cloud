import { PermissionGuard } from "~/components/guards/permission-guard";

export default function DepartmentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PermissionGuard action="manage" subject="Department">
      {children}
    </PermissionGuard>
  );
}
