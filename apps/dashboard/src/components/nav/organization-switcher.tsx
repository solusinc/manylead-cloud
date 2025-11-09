"use client";

import { ChevronsUpDown, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@manylead/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@manylead/ui/sidebar";
import Link from "next/link";
import { useTRPC } from "~/lib/trpc/react";
import { authClient } from "~/lib/auth/client";

export function OrganizationSwitcher() {
  const { isMobile, setOpenMobile } = useSidebar();
  const trpc = useTRPC();

  const { data: organization, isLoading: isLoadingOrg } = useQuery(
    trpc.organization.getCurrent.queryOptions(),
  );
  const { data: organizations, isLoading: isLoadingOrgs } = useQuery(
    trpc.organization.list.queryOptions(),
  );

  // Se não há organização ativa mas há organizações disponíveis, use a primeira
  const activeOrg = organization ?? organizations?.[0];

  if (isLoadingOrg || isLoadingOrgs) {
    return null;
  }

  if (!activeOrg) {
    return null;
  }

  async function handleClick(organizationId: string) {
    await authClient.organization.setActive({
      organizationId,
    });
    // eslint-disable-next-line react-hooks/immutability -- needed for navigation
    window.location.href = "/overview";
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="h-14 rounded-none px-4 ring-inset data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground group-data-[collapsible=icon]:mx-2!"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary">
                <div className="size-8 overflow-hidden rounded-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://api.dicebear.com/9.x/glass/svg?seed=${activeOrg.slug}`}
                    alt="avatar"
                  />
                </div>
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <div className="truncate font-medium">
                  {activeOrg.name || "Organização sem nome"}
                </div>
                <div className="truncate text-xs">
                  <span className="font-inter tracking-tight">
                    {activeOrg.slug}
                  </span>
                </div>
              </div>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              Organizações
            </DropdownMenuLabel>
            {organizations?.map((org) => (
              <DropdownMenuItem
                key={org.id}
                onClick={() => {
                  void handleClick(org.id);
                  setOpenMobile(false);
                }}
                className="gap-2 p-2"
              >
                <span className="truncate">
                  {org.name || "Organização sem nome"}
                </span>
                <span className="truncate font-mono text-muted-foreground text-xs">
                  {org.slug}
                </span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 p-2" asChild>
              <Link href="/settings/general">
                <Plus />
                <div className="font-inter text-muted-foreground tracking-tight">
                  Adicionar membro
                </div>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
