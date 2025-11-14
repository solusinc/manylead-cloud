import { PermissionGuard } from "~/components/guards/permission-guard";

export default function ChannelsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PermissionGuard action="manage" subject="Channel">
      {children}
    </PermissionGuard>
  );
}
