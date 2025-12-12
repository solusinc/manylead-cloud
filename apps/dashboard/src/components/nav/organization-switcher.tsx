"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronsUpDown, Loader2, Plus } from "lucide-react";

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

import { useTRPC } from "~/lib/trpc/react";
import { usePermissions } from "~/lib/permissions";

export function OrganizationSwitcher() {
  const { isMobile, setOpenMobile } = useSidebar();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { can } = usePermissions();

  // OrganizationGuard cuida do refetch e redirecionamento global
  const { data: organization, isLoading: isLoadingOrg } = useQuery(
    trpc.organization.getCurrent.queryOptions(),
  );
  const { data: organizations, isLoading: isLoadingOrgs } = useQuery(
    trpc.organization.list.queryOptions(),
  );

  const setActiveMutation = useMutation(
    trpc.organization.setActive.mutationOptions({
      onSuccess: async () => {
        // Invalidar TODAS as queries para recarregar dados da nova org
        await queryClient.invalidateQueries();

        // Forçar re-render dos server components (busca novo role/permissions do servidor)
        router.refresh();

        // Delay para garantir que o servidor busque o novo role antes de navegar
        await new Promise((resolve) => setTimeout(resolve, 300));

        // Navegar para chats
        router.push("/chats");
      },
      onError: (error) => {
        console.error("Failed to switch organization:", error);
      },
    }),
  );

  // Se não há organização ativa mas há organizações disponíveis, use a primeira
  const activeOrg = organization ?? organizations?.[0];

  if (isLoadingOrg || isLoadingOrgs) {
    return null;
  }

  if (!activeOrg) {
    return null;
  }

  function handleClick(organizationId: string) {
    // Sincronizar com servidor e AGUARDAR (UX honesta)
    // Callbacks (invalidação e navegação) estão em mutationOptions
    void setActiveMutation.mutateAsync({ organizationId });
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild disabled={setActiveMutation.isPending}>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground h-14 rounded-none px-4 ring-inset group-data-[collapsible=icon]:mx-2! focus-visible:ring-0 focus-visible:ring-offset-0"
            >
              <div className="bg-sidebar-primary flex aspect-square size-8 items-center justify-center rounded-lg">
                <div className="size-8 overflow-hidden rounded-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={
                      activeOrg.logo ??
                      `https://api.dicebear.com/9.x/glass/svg?seed=${activeOrg.slug}`
                    }
                    alt="avatar"
                  />
                </div>
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <div className="truncate font-medium">
                  {activeOrg.name || "Organização sem nome"}
                </div>
              </div>
              {setActiveMutation.isPending ? (
                <Loader2 className="ml-auto animate-spin" />
              ) : (
                <ChevronsUpDown className="ml-auto" />
              )}
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
                disabled={setActiveMutation.isPending}
                className="gap-2 p-2"
              >
                <span className="truncate">
                  {org.name || "Organização sem nome"}
                </span>
              </DropdownMenuItem>
            ))}
            {can("manage", "Agent") && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2 p-2" asChild>
                  <Link href="/settings/users">
                    <Plus />
                    <div className="font-inter text-muted-foreground tracking-tight">
                      Adicionar usuário
                    </div>
                  </Link>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
