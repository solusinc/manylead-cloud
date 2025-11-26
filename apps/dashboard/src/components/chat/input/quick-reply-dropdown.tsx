"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MessageSquareText } from "lucide-react";

import type { QuickReplyMessage } from "@manylead/db/schema";
import { cn } from "@manylead/ui";
import { ScrollArea } from "@manylead/ui/scroll-area";

import { useTRPC } from "~/lib/trpc/react";
import { useServerSession } from "~/components/providers/session-provider";
import { useChatReply } from "../providers/chat-reply-provider";

export interface QuickReplySelection {
  id: string;
  messages: QuickReplyMessage[];
}

interface QuickReplyDropdownProps {
  searchTerm: string;
  onSelect: (selection: QuickReplySelection) => void;
  onClose: () => void;
  isOpen: boolean;
}

export function QuickReplyDropdown({
  searchTerm,
  onSelect,
  onClose,
  isOpen,
}: QuickReplyDropdownProps) {
  const trpc = useTRPC();
  const session = useServerSession();
  const { contactName } = useChatReply();
  const [rawSelectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Buscar organização do usuário logado (não do contato!)
  const { data: currentOrganization } = useQuery(
    trpc.organization.getCurrent.queryOptions(),
  );

  // Buscar quick replies que correspondem ao termo de busca
  const { data: quickReplies = [], isLoading } = useQuery({
    ...trpc.quickReplies.search.queryOptions({
      query: searchTerm,
      limit: 10,
    }),
    enabled: isOpen && searchTerm.length >= 0,
  });

  // Garantir que o índice selecionado é sempre válido
  const selectedIndex = quickReplies.length > 0
    ? Math.min(rawSelectedIndex, quickReplies.length - 1)
    : 0;

  const replaceVariables = useCallback((content: string): string => {
    const agentName = session.user.name;
    const orgName = currentOrganization?.name ?? "";

    return content
      .replace(/\{\{contact\.name\}\}/g, contactName)
      .replace(/\{\{agent\.name\}\}/g, agentName)
      .replace(/\{\{organization\.name\}\}/g, orgName);
  }, [session.user.name, contactName, currentOrganization?.name]);

  const handleSelect = useCallback((quickReply: { id: string; messages: QuickReplyMessage[] }) => {
    // Processa as variáveis em cada mensagem
    const processedMessages = quickReply.messages.map((msg) => ({
      ...msg,
      content: replaceVariables(msg.content),
    }));

    onSelect({
      id: quickReply.id,
      messages: processedMessages,
    });
    onClose();
  }, [replaceVariables, onSelect, onClose]);

  // Pega o preview da primeira mensagem de texto
  const getPreviewContent = useCallback((messages: QuickReplyMessage[]): string => {
    const firstText = messages.find((m) => m.type === "text");
    return firstText?.content ?? "";
  }, []);

  // Scroll para o item selecionado
  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.querySelector(
        `[data-index="${selectedIndex}"]`
      );
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex]);

  // Handler para teclas de navegação
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < quickReplies.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
      } else if (e.key === "Enter" && quickReplies.length > 0) {
        e.preventDefault();
        const selected = quickReplies[selectedIndex];
        if (selected) {
          handleSelect({ id: selected.id, messages: selected.messages });
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, quickReplies, selectedIndex, onClose, handleSelect]);

  if (!isOpen) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 z-50 mb-2">
      <div className="bg-popover border rounded-lg shadow-lg overflow-hidden mx-2">
        {isLoading ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Carregando...
          </div>
        ) : quickReplies.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Nenhuma resposta rápida encontrada
          </div>
        ) : (
          <ScrollArea className="max-h-[280px] overflow-auto">
            <div ref={listRef} className="py-1">
              {quickReplies.map((quickReply, index) => (
                <button
                  key={quickReply.id}
                  data-index={index}
                  onClick={() => handleSelect({ id: quickReply.id, messages: quickReply.messages })}
                  className={cn(
                    "w-full flex items-start gap-3 px-4 py-3 text-left transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    selectedIndex === index && "bg-accent text-accent-foreground"
                  )}
                >
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <MessageSquareText className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">
                        {quickReply.title}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">
                        {quickReply.shortcut}
                      </span>
                      {quickReply.messages.length > 1 && (
                        <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                          {quickReply.messages.length} mensagens
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {replaceVariables(getPreviewContent(quickReply.messages))}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
