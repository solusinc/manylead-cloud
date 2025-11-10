import { cn } from "@manylead/ui";

export function TableCellDate({
  value,
  className,
  ...props
}: React.ComponentProps<"div"> & { value: unknown }) {
  if (typeof value === "string") {
    return (
      <div className={cn("text-muted-foreground", className)} {...props}>
        {value}
      </div>
    );
  }
  return (
    <div className={cn("text-muted-foreground", className)} {...props}>
      -
    </div>
  );
}
