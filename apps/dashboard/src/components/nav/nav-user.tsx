"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Check,
  ChevronsUpDown,
  Copy,
  CreditCard,
  Laptop,
  LogOut,
  Moon,
  Sun,
  User,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@manylead/ui/avatar";
import { Button } from "@manylead/ui/button";
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
import { Input } from "@manylead/ui/input";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@manylead/ui/sidebar";
import { Skeleton } from "@manylead/ui/skeleton";
import { useTheme } from "@manylead/ui/theme";

import { authClient, useSession } from "~/lib/auth/client";
import { usePermissions } from "~/lib/permissions";
import { useServerSession } from "~/components/providers/session-provider";
import { useTRPC } from "~/lib/trpc/react";

export function NavUser() {
  const { isMobile, setOpenMobile } = useSidebar();
  const { themeMode, setTheme } = useTheme();

  // Use server session for SSR (avoid hydration error)
  const serverSession = useServerSession();

  // Use client session for real-time updates (after hydration)
  const { data: clientSession } = useSession();

  // Prefer client session if available (for real-time updates), fallback to server
  const session = clientSession ?? serverSession;

  const router = useRouter();
  const trpc = useTRPC();
  const { can } = usePermissions();
  const [copied, setCopied] = useState(false);

  const { data: organization, isLoading: isLoadingOrg } = useQuery(
    trpc.organization.getCurrent.queryOptions(),
  );
  const { data: organizations, isLoading: isLoadingOrgs } = useQuery(
    trpc.organization.list.queryOptions(),
  );

  // Se não há organização ativa mas há organizações disponíveis, use a primeira
  const activeOrg = organization ?? organizations?.[0];

  // Renderizar skeleton enquanto carrega para evitar hydration mismatch
  if (isLoadingOrg || isLoadingOrgs) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size="lg"
            className="h-14 rounded-none px-4 ring-inset group-data-[collapsible=icon]:mx-2!"
          >
            <Skeleton className="h-8 w-8 rounded-lg" />
            <div className="grid flex-1 gap-1.5 text-left text-sm leading-tight">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  if (!activeOrg) {
    return null;
  }

  const user = session.user;
  const userName = user.name;

  async function handleSignOut() {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/sign-in");
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
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground h-14 rounded-none px-4 ring-inset group-data-[collapsible=icon]:mx-2! focus-visible:ring-0 focus-visible:ring-offset-0"
            >
              <div className="overflow-visible">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={user.image ?? undefined} alt={userName} />
                  <AvatarFallback className="rounded-lg uppercase">
                    {userName.slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{userName}</span>
                <span className="font-inter truncate text-xs tracking-tight">
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
                  <span className="font-inter truncate text-xs tracking-tight">
                    {user.email}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {activeOrg.instanceCode && (
              <>
                <div className="px-2 py-2">
                  <label className="text-muted-foreground mb-1.5 block text-xs">
                    Código da instância
                  </label>
                  <div className="group relative">
                    <Input
                      value={activeOrg.instanceCode}
                      readOnly
                      className="border-input hover:border-input focus:border-input group-hover:border-input pr-10 font-mono text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-0 right-0 h-full border-0 px-3 shadow-none outline-none hover:border-transparent! hover:bg-transparent focus-visible:border-transparent! focus-visible:ring-0 focus-visible:ring-offset-0 dark:hover:bg-transparent dark:focus-visible:border-transparent"
                      onClick={() => {
                        void navigator.clipboard.writeText(
                          activeOrg.instanceCode,
                        );
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <DropdownMenuSeparator />
              </>
            )}
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
                <DropdownMenuSubTrigger className="[&_svg:not([class*='text-'])]:text-muted-foreground gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4">
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
              {can("read", "Billing") && (
                <DropdownMenuItem asChild>
                  <Link
                    href="/settings/billing"
                    onClick={() => setOpenMobile(false)}
                  >
                    <CreditCard />
                    Faturamento
                  </Link>
                </DropdownMenuItem>
              )}
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
