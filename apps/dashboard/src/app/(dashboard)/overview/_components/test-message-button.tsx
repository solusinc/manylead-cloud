"use client";

import { useState } from "react";
import { toast } from "sonner";
import { MessageSquare } from "lucide-react";
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@manylead/ui";
import { useTRPC } from "~/lib/trpc/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";

export function TestMessageButton() {
  const trpc = useTRPC();
  const [selectedChannelId, setSelectedChannelId] = useState<string>("");

  // Buscar canais conectados
  const { data: channels, isLoading: isLoadingChannels } = useQuery(
    trpc.channels.list.queryOptions()
  );

  const connectedChannels =
    channels?.filter((ch) => ch.status === "connected") ?? [];

  // Mutation para enviar mensagem
  const { mutate: sendMessage, isPending } = useMutation(
    trpc.channels.sendTestMessage.mutationOptions({
      onSuccess: () => {
        toast.success("Mensagem de teste enviada com sucesso!");
      },
      onError: (error) => {
        const message = isTRPCClientError(error)
          ? error.message
          : "Falha ao enviar mensagem";
        toast.error(message);
      },
    })
  );

  const handleSendTestMessage = () => {
    if (!selectedChannelId) {
      toast.error("Selecione um canal primeiro");
      return;
    }

    sendMessage({
      channelId: selectedChannelId,
      to: "+5521984848843",
      text: "Olá! Esta é uma mensagem de teste do ManyLead. 🚀",
    });
  };

  if (isLoadingChannels) {
    return (
      <Button disabled variant="outline">
        Carregando canais...
      </Button>
    );
  }

  if (connectedChannels.length === 0) {
    return (
      <Button disabled variant="outline">
        <MessageSquare className="size-4" />
        Nenhum canal conectado
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={selectedChannelId} onValueChange={setSelectedChannelId}>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Selecione um canal" />
        </SelectTrigger>
        <SelectContent>
          {connectedChannels.map((ch) => (
            <SelectItem key={ch.id} value={ch.id}>
              {ch.displayName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        onClick={handleSendTestMessage}
        disabled={isPending || !selectedChannelId}
        variant="outline"
      >
        <MessageSquare className="size-4" />
        {isPending ? "Enviando..." : "Enviar mensagem de teste"}
      </Button>
    </div>
  );
}
