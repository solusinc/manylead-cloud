"use client";

import { useState, useRef } from "react";
import { Check, Tag } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useDisclosure } from "~/hooks/use-disclosure";

import { cn } from "@manylead/ui";
import { Button } from "@manylead/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@manylead/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@manylead/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@manylead/ui/tooltip";

import { useTRPC } from "~/lib/trpc/react";

interface ChatTagSelectorProps {
  chatId: string;
  chatCreatedAt: Date;
}

export function ChatTagSelector({ chatId, chatCreatedAt }: ChatTagSelectorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { isOpen, setIsOpen } = useDisclosure();
  const [inputValue, setInputValue] = useState("");

  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Buscar todas as tags disponiveis
  const { data: allTags = [] } = useQuery(trpc.tags.list.queryOptions());

  // Buscar tags associadas ao chat
  const { data: chatTags = [] } = useQuery(
    trpc.tags.listByChatId.queryOptions({ chatId, chatCreatedAt }),
  );

  // IDs das tags selecionadas
  const selectedIds = chatTags.map((t) => t.id);

  // Mutation para adicionar tag
  const addMutation = useMutation(
    trpc.tags.addToChat.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.tags.listByChatId.queryKey({ chatId, chatCreatedAt }),
        });
        // Invalidar lista de chats para atualizar badges no inbox
        void queryClient.invalidateQueries({
          queryKey: [["chats", "list"]],
        });
      },
      onError: (error) => {
        toast.error(error.message || "Erro ao adicionar etiqueta");
      },
    }),
  );

  // Mutation para remover tag
  const removeMutation = useMutation(
    trpc.tags.removeFromChat.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.tags.listByChatId.queryKey({ chatId, chatCreatedAt }),
        });
        // Invalidar lista de chats para atualizar badges no inbox
        void queryClient.invalidateQueries({
          queryKey: [["chats", "list"]],
        });
      },
      onError: (error) => {
        toast.error(error.message || "Erro ao remover etiqueta");
      },
    }),
  );

  const handleToggle = (tagId: string) => {
    const isSelected = selectedIds.includes(tagId);

    if (isSelected) {
      removeMutation.mutate({ chatId, chatCreatedAt, tagId });
    } else {
      addMutation.mutate({ chatId, chatCreatedAt, tagId });
    }

    inputRef.current?.focus();
  };

  const handleOpenChange = (value: boolean) => {
    inputRef.current?.blur();
    setIsOpen(value);
    if (!value) {
      setInputValue("");
    }
  };

  // Filtrar tags pelo input
  const filteredTags = allTags.filter((tag) =>
    tag.name.toLowerCase().includes(inputValue.toLowerCase()),
  );

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Etiquetas"
              className="relative text-muted-foreground"
            >
              <Tag className="size-5" />
              {selectedIds.length > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                  {selectedIds.length}
                </span>
              )}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>
          <p>Etiquetas</p>
        </TooltipContent>
      </Tooltip>

      <PopoverContent className="w-64 p-0" align="end">
        <Command loop>
          <CommandInput
            ref={inputRef}
            placeholder="buscar etiqueta..."
            value={inputValue}
            onValueChange={setInputValue}
          />
          <CommandList>
            <CommandEmpty>Nenhuma etiqueta encontrada.</CommandEmpty>
            <CommandGroup className="max-h-[200px] overflow-auto">
              {filteredTags.map((tag) => {
                const isSelected = selectedIds.includes(tag.id);
                return (
                  <CommandItem
                    key={tag.id}
                    value={tag.name}
                    onSelect={() => handleToggle(tag.id)}
                    disabled={addMutation.isPending || removeMutation.isPending}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        isSelected ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <div className="flex-1">{tag.name}</div>
                    <div
                      className="h-4 w-4 rounded-full border"
                      style={{ backgroundColor: tag.color }}
                    />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
