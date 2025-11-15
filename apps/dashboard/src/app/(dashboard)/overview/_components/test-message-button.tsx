"use client";

import { useState } from "react";
import { toast } from "sonner";
import { MessageSquare } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@manylead/ui";
import { useTRPC } from "~/lib/trpc/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";

export function TestMessageButton() {
  const trpc = useTRPC();
  const [selectedChannelId, setSelectedChannelId] = useState<string>("");
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const [message, setMessage] = useState<string>(
    "Olá! Esta é uma mensagem de teste do ManyLead. 🚀"
  );
  const [isDialogOpen, setIsDialogOpen] = useState(false);

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
        setIsDialogOpen(false);
        setPhoneNumber("");
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

    if (!phoneNumber) {
      toast.error("Digite um número de telefone");
      return;
    }

    sendMessage({
      channelId: selectedChannelId,
      to: phoneNumber,
      text: message,
    });
  };

  if (isLoadingChannels) {
    return (
      <Button disabled variant="outline">
        <MessageSquare className="size-4" />
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
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <MessageSquare className="size-4" />
          Enviar mensagem de teste
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar mensagem de teste</DialogTitle>
          <DialogDescription>
            Envie uma mensagem de teste para verificar se o canal está
            funcionando corretamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="channel">Canal</Label>
            <Select
              value={selectedChannelId}
              onValueChange={setSelectedChannelId}
            >
              <SelectTrigger id="channel">
                <SelectValue placeholder="Selecione um canal conectado" />
              </SelectTrigger>
              <SelectContent>
                {connectedChannels.map((ch) => (
                  <SelectItem key={ch.id} value={ch.id}>
                    {ch.displayName} ({ch.phoneNumber})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Número de telefone</Label>
            <Input
              id="phone"
              placeholder="+5521984848843"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Formato: +{"{"}código do país{"}"}
              {"{"}DDD{"}"}
              {"{"}número{"}"} (ex: +5521984848843)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Mensagem</Label>
            <Textarea
              id="message"
              placeholder="Digite sua mensagem..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setIsDialogOpen(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button onClick={handleSendTestMessage} disabled={isPending}>
            {isPending ? "Enviando..." : "Enviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
