import Link from "next/link";
import { ArrowUpRight, ChevronRight } from "lucide-react";

import { cn } from "@manylead/ui";

export function TableCellLink({
  value,
  className,
  href,
  ...props
}: React.ComponentProps<typeof Link> & {
  value: unknown;
}) {
  if (typeof value === "string" && href) {
    const hrefStr = typeof href === "string" ? href : "";
    const isExternal = hrefStr.startsWith("http");
    const externalProps = isExternal
      ? { target: "_blank" as const, rel: "noopener noreferrer" }
      : {};
    const Icon = isExternal ? ArrowUpRight : ChevronRight;
    return (
      <Link
        href={href}
        className={cn(
          "group/link flex w-full items-center justify-between gap-2 hover:underline",
          className,
        )}
        {...externalProps}
        {...props}
      >
        <span className="truncate">{value}</span>
        <Icon className="text-muted-foreground group-hover/link:text-foreground size-4 shrink-0" />
      </Link>
    );
  }
  return <div className="text-muted-foreground">-</div>;
}
