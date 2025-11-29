"use client";

import { useState } from "react";
import { Search, ArrowRightLeft } from "lucide-react";
import { useDisclosure } from "~/hooks/use-disclosure";
import { cn } from "@manylead/ui";
import { Button } from "@manylead/ui/button";
import { Input } from "@manylead/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@manylead/ui/dropdown-menu";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/lib/trpc/react";
import { toast } from "sonner";
import { useCurrentAgent } from "~/hooks/chat/use-current-agent";

interface ChatTransferDropdownProps {
  chatId: string;
  chatCreatedAt: Date;
}

export function ChatTransferDropdown({
  chatId,
  chatCreatedAt,
}: ChatTransferDropdownProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"users" | "departments">("users");
  const { isOpen, setIsOpen, onClose } = useDisclosure();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Buscar agente atual
  const { data: currentAgent } = useCurrentAgent();

  // Buscar usuários/agentes
  const { data: agents } = useQuery(trpc.agents.list.queryOptions());

  // Buscar departamentos
  const { data: departments } = useQuery(trpc.departments.list.queryOptions());

  // Mutation de transferência
  const transferMutation = useMutation(
    trpc.chats.transfer.mutationOptions({
      onSuccess: () => {
        // Invalidar queries para atualizar a lista
        void queryClient.invalidateQueries({ queryKey: [["chats", "list"]] });
        toast.success("Chat transferido com sucesso!");
        onClose();
      },
      onError: (error) => {
        toast.error(error.message || "Erro ao transferir chat");
      },
    })
  );

  // Filtrar usuários baseado na busca (excluir agente atual)
  const filteredAgents = agents?.filter((agent) =>
    agent.id !== currentAgent?.id &&
    agent.user?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filtrar departamentos baseado na busca
  const filteredDepartments = departments?.filter((dept) =>
    dept.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleTransferToUser = (agentId: string) => {
    transferMutation.mutate({
      id: chatId,
      createdAt: chatCreatedAt,
      targetAgentId: agentId,
    });
  };

  const handleTransferToDepartment = (departmentId: string) => {
    transferMutation.mutate({
      id: chatId,
      createdAt: chatCreatedAt,
      targetDepartmentId: departmentId,
    });
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Transferir">
          <ArrowRightLeft className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 p-0">
        {/* Header com título */}
        <div className="px-4 py-3 border-b">
          <p className="text-sm font-medium">Transferir atendimento</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab("users")}
            className={cn(
              "flex-1 px-4 py-2.5 text-sm font-medium transition-colors border-b-2",
              activeTab === "users"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Usuários
          </button>
          <button
            onClick={() => setActiveTab("departments")}
            className={cn(
              "flex-1 px-4 py-2.5 text-sm font-medium transition-colors border-b-2",
              activeTab === "departments"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Depart.
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={
                activeTab === "users"
                  ? "Buscar usuário..."
                  : "Buscar departamento..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-9"
            />
          </div>
        </div>

        {/* Lista */}
        <div className="max-h-64 overflow-y-auto">
          {activeTab === "users" ? (
            <>
              {filteredAgents?.map((agent) => (
                <DropdownMenuItem
                  key={agent.id}
                  onClick={() => handleTransferToUser(agent.id)}
                  className="cursor-pointer rounded-none px-4 py-3"
                >
                  <div className="flex flex-col gap-0.5">
                    <p className="font-medium">{agent.user?.name}</p>
                    {agent.user && (
                      <p className="text-xs text-muted-foreground">
                        {agent.user.email}
                      </p>
                    )}
                  </div>
                </DropdownMenuItem>
              ))}
              {filteredAgents?.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Nenhum usuário encontrado
                </div>
              )}
            </>
          ) : (
            <>
              {filteredDepartments?.map((dept) => (
                <DropdownMenuItem
                  key={dept.id}
                  onClick={() => handleTransferToDepartment(dept.id)}
                  className="cursor-pointer rounded-none px-4 py-3"
                >
                  <p className="font-medium">{dept.name}</p>
                </DropdownMenuItem>
              ))}
              {filteredDepartments?.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Nenhum departamento encontrado
                </div>
              )}
            </>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
