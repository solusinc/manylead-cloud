"use client";

import { useState, useRef } from "react";
import { CheckCircle } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useDisclosure } from "~/hooks/use-disclosure";

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

interface ChatEndingSelectorProps {
  chatId: string;
  chatCreatedAt: Date;
}

export function ChatEndingSelector({ chatId, chatCreatedAt }: ChatEndingSelectorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { isOpen, setIsOpen, onClose } = useDisclosure();
  const [inputValue, setInputValue] = useState("");

  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Buscar todos os endings disponíveis
  const { data: endings = [] } = useQuery(trpc.endings.list.queryOptions());

  // Mutation para fechar chat com ending
  const closeMutation = useMutation(
    trpc.chats.close.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: [["chats"]] });
        void queryClient.invalidateQueries({ queryKey: [["messages"]] });
        onClose();
      },
      onError: (error) => {
        toast.error(error.message || "Erro ao finalizar atendimento");
      },
    }),
  );

  const handleSelect = (endingId: string) => {
    closeMutation.mutate({
      id: chatId,
      createdAt: chatCreatedAt,
      endingId,
    });
  };

  const handleOpenChange = (value: boolean) => {
    inputRef.current?.blur();
    setIsOpen(value);
    if (!value) {
      setInputValue("");
    }
  };

  // Filtrar endings pelo input
  const filteredEndings = endings.filter((ending) =>
    ending.title.toLowerCase().includes(inputValue.toLowerCase()),
  );

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Finalizar"
              disabled={closeMutation.isPending}
              className="text-muted-foreground"
            >
              <CheckCircle className="size-5" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>
          <p>Finalizar</p>
        </TooltipContent>
      </Tooltip>

      <PopoverContent className="w-72 p-0" align="end">
        <Command loop>
          <CommandInput
            ref={inputRef}
            placeholder="buscar motivo..."
            value={inputValue}
            onValueChange={setInputValue}
          />
          <CommandList>
            <CommandEmpty>Nenhum motivo encontrado.</CommandEmpty>
            <CommandGroup className="max-h-[200px] overflow-auto">
              {filteredEndings.map((ending) => (
                <CommandItem
                  key={ending.id}
                  value={ending.title}
                  onSelect={() => handleSelect(ending.id)}
                  disabled={closeMutation.isPending}
                >
                  {ending.title}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
