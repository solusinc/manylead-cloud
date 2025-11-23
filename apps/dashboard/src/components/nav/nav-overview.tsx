"use client";

import type { LucideIcon } from "lucide-react";

import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@manylead/ui/sidebar";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavOverview({
  items,
}: {
  items: {
    name: string;
    url: string;
    icon: LucideIcon;
  }[];
}) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  return (
    <SidebarGroup>
      <SidebarMenu>
        {items.map((item) => (
          <SidebarMenuItem key={item.name}>
            <SidebarMenuButton
              isActive={pathname.startsWith(item.url)}
              asChild
              tooltip={item.name}
            >
              <Link
                href={item.url}
                onClick={() => setOpenMobile(false)}
                className="font-inter font-medium tracking-tight"
              >
                <item.icon />
                <span>{item.name}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
