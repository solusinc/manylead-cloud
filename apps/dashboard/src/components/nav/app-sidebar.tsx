"use client";

import * as React from "react";
import {
  MessageSquare,
  Settings,
  Calendar,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@manylead/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@manylead/ui/tooltip";

import { Kbd } from "~/components/common/kbd";
import { NavOverview } from "~/components/nav/nav-overview";
import { NavUser } from "~/components/nav/nav-user";
import { OrganizationSwitcher } from "~/components/nav/organization-switcher";

const SIDEBAR_KEYBOARD_SHORTCUT = "[";

// Navigation data
const data = {
  overview: [
    {
      name: "Chats",
      url: "/chats",
      icon: MessageSquare,
    },
    {
      name: "Agendamentos",
      url: "/schedules",
      icon: Calendar,
    },
    {
      name: "Configurações",
      url: "/settings",
      icon: Settings,
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="flex h-14 justify-center gap-0 border-b p-0">
        <OrganizationSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <NavOverview items={data.overview} />
      </SidebarContent>
      <SidebarFooter className="flex h-14 flex-col justify-center gap-0 border-t p-0">
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

export function AppSidebarTrigger() {
  const { toggleSidebar } = useSidebar();

  // Adds a keyboard shortcut to toggle the sidebar.
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === SIDEBAR_KEYBOARD_SHORTCUT &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault();
        toggleSidebar();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <SidebarTrigger />
      </TooltipTrigger>
      <TooltipContent side="right">
        <p className="mr-px inline-flex items-center">
          Toggle Sidebar{" "}
          <Kbd className="border-muted-foreground bg-primary text-background font-mono">
            ⌘
          </Kbd>
          <Kbd className="border-muted-foreground bg-primary text-background font-mono">
            {SIDEBAR_KEYBOARD_SHORTCUT}
          </Kbd>
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
