"use client";

import {
  ChevronsUpDown,
  CreditCard,
  Laptop,
  LogOut,
  Moon,
  Sparkles,
  Sun,
  User,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@manylead/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@manylead/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@manylead/ui/sidebar";
import { useTheme } from "@manylead/ui/theme";
import Link from "next/link";

export function NavUser() {
  const { isMobile, setOpenMobile } = useSidebar();
  const { themeMode, setTheme } = useTheme();

  // TODO: Implement TRPC queries and Better Auth
  // const trpc = useTRPC();
  // const { data: organization } = useQuery(trpc.organizations.getCurrent.queryOptions());
  // const { data: user } = useQuery(trpc.user.get.queryOptions());

  // Mock data for now
  const organization = {
    id: "1",
    name: "My Organization",
    slug: "my-org",
    plan: "free",
  };

  const user = {
    id: "1",
    name: "John Doe",
    email: "john@example.com",
    image: null as string | null,
  };

  const userName = user.name;

  function handleSignOut() {
    // TODO: Implement Better Auth signOut
    // await signOut({ callbackUrl: "/sign-in" });
     
    window.location.href = "/sign-in";
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
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={user.image ?? undefined} alt={userName} />
                <AvatarFallback className="rounded-lg uppercase">
                  {userName.slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{userName}</span>
                <span className="truncate font-inter text-xs tracking-tight">
                  {user.email}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={user.image ?? undefined} alt={userName} />
                  <AvatarFallback className="rounded-lg">
                    {userName.slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{userName}</span>
                  <span className="truncate font-inter text-xs tracking-tight">
                    {user.email}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {organization.plan === "free" ? (
              <>
                <DropdownMenuItem asChild>
                  <Link
                    href="/settings/billing"
                    onClick={() => setOpenMobile(false)}
                    className="font-inter tracking-tight"
                  >
                    <Sparkles />
                    Upgrade Organization
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            ) : null}
            <DropdownMenuGroup className="font-inter tracking-tight">
              <DropdownMenuItem asChild>
                <Link
                  href="/settings/account"
                  onClick={() => setOpenMobile(false)}
                >
                  <User />
                  Account
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="gap-2 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0">
                  {themeMode === "dark" ? (
                    <Moon />
                  ) : themeMode === "light" ? (
                    <Sun />
                  ) : (
                    <Laptop />
                  )}
                  Theme
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent className="font-inter tracking-tight">
                    <DropdownMenuItem onClick={() => setTheme("light")}>
                      <Sun /> Light
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTheme("dark")}>
                      <Moon /> Dark
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTheme("auto")}>
                      <Laptop /> Auto
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
              <DropdownMenuItem asChild>
                <Link
                  href="/settings/billing"
                  onClick={() => setOpenMobile(false)}
                >
                  <CreditCard />
                  Billing
                </Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => handleSignOut()}
              className="font-inter tracking-tight"
            >
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
