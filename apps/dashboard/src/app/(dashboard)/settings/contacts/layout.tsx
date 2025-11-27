import { PermissionGuard } from "~/components/guards/permission-guard";

export default function ContactsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PermissionGuard action="manage" subject="Contact">
      {children}
    </PermissionGuard>
  );
}
