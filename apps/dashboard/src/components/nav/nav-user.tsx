"use client";

import {
  ChevronsUpDown,
  CreditCard,
  Laptop,
  LogOut,
  Moon,
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
import { useTRPC } from "~/lib/trpc/react";
import { useQuery } from "@tanstack/react-query";
import { authClient, useSession } from "~/lib/auth/client";

export function NavUser() {
  const { isMobile, setOpenMobile } = useSidebar();
  const { themeMode, setTheme } = useTheme();
  const { data: session } = useSession();
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

  if (!session?.user || !activeOrg) {
    return null;
  }

  const user = session.user;
  const userName = user.name;

  async function handleSignOut() {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.href = "/sign-in";
        },
      },
    });
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
            {/* TODO: Implementar verificação de plano quando tiver billing
            {activeOrg.plan === "free" ? (
              <>
                <DropdownMenuItem asChild>
                  <Link
                    href="/settings/billing"
                    onClick={() => setOpenMobile(false)}
                    className="font-inter tracking-tight"
                  >
                    <Sparkles />
                    Fazer Upgrade
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            ) : null} */}
            <DropdownMenuGroup className="font-inter tracking-tight">
              <DropdownMenuItem asChild>
                <Link
                  href="/settings/account"
                  onClick={() => setOpenMobile(false)}
                >
                  <User />
                  Conta
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
                  Tema
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent className="font-inter tracking-tight">
                    <DropdownMenuItem onClick={() => setTheme("light")}>
                      <Sun /> Claro
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTheme("dark")}>
                      <Moon /> Escuro
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTheme("auto")}>
                      <Laptop /> Automático
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
                  Faturamento
                </Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => void handleSignOut()}
              className="font-inter tracking-tight"
            >
              <LogOut />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
