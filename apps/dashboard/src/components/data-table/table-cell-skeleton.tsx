import { Skeleton } from "@manylead/ui/skeleton";
import { cn } from "@manylead/ui";

export function TableCellSkeleton({
  className,
  ...props
}: React.ComponentProps<typeof Skeleton>) {
  return <Skeleton className={cn("h-5 w-12", className)} {...props} />;
}
