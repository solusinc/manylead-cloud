"use client";

import { ChevronsUpDown, Plus } from "lucide-react";

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

export function OrganizationSwitcher() {
  const { isMobile, setOpenMobile } = useSidebar();

  // TODO: Implement TRPC queries
  // const trpc = useTRPC();
  // const { data: organization } = useQuery(trpc.organizations.getCurrent.queryOptions());
  // const { data: organizations } = useQuery(trpc.organizations.list.queryOptions());

  // Mock data for now
  const organization = {
    id: "1",
    name: "My Organization",
    slug: "my-org",
    plan: "free",
  };

  const organizations = [organization];

  function handleClick(slug: string) {
    // eslint-disable-next-line react-hooks/immutability -- needed for cookie setting
    document.cookie = `organization-slug=${slug}; path=/;`;
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
                    src={`https://api.dicebear.com/9.x/glass/svg?seed=${organization.slug}`}
                    alt="avatar"
                  />
                </div>
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <div className="truncate font-medium">
                  {organization.name || "Untitled Organization"}
                </div>
                <div className="truncate text-xs">
                  <span className="font-inter tracking-tight">
                    {organization.slug}
                  </span>{" "}
                  <span className="text-muted-foreground">
                    {organization.plan}
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
              Organizations
            </DropdownMenuLabel>
            {organizations.map((org) => (
              <DropdownMenuItem
                key={org.id}
                onClick={() => {
                  handleClick(org.slug);
                  setOpenMobile(false);
                }}
                className="gap-2 p-2"
              >
                <span className="truncate">
                  {org.name || "Untitled Organization"}
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
                  Add team member
                </div>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
