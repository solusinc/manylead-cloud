"use client";

import { useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, XCircle } from "lucide-react";
import { toast } from "sonner";

import { formatBrazilianPhone } from "@manylead/shared/utils";
import { Button } from "@manylead/ui/button";

import { useChannelSocket } from "~/hooks/use-channel-socket";
import { useTRPC } from "~/lib/trpc/react";
import { useConnectionModalStore } from "~/stores/use-connection-modal-store";

export function ConnectedStep() {
  const { goBack, channelId, reset } = useConnectionModalStore();
  const { isConnected, connect } = useChannelSocket();
  const trpc = useTRPC();

  // Buscar dados do canal
  const { data: channel, refetch } = useQuery({
    ...trpc.channels.getById.queryOptions({ id: channelId ?? "" }),
    enabled: !!channelId,
    refetchInterval: 3000, // Polling para detectar mudanças de status
  });

  // Obter organização atual
  const { data: currentOrg } = useQuery(
    trpc.organization.getCurrent.queryOptions(),
  );

  // Conectar ao Socket.io ao montar
  useEffect(() => {
    if (!currentOrg?.id || isConnected) return;
    void connect(currentOrg.id);
  }, [connect, isConnected, currentOrg?.id]);

  // Monitorar status do canal e voltar para início se desconectar
  useEffect(() => {
    if (channel?.status === "disconnected") {
      // Voltar para a tela de método ou fechar modal
      reset();
    }
  }, [channel, reset]);

  // Mutation para desconectar
  const disconnectMutation = useMutation(
    trpc.channels.disconnect.mutationOptions({
      onSuccess: async () => {
        toast.success("Canal desconectado");
        // Refetch para pegar status atualizado
        await refetch();
        // Aguardar um pouco para garantir que o DB foi atualizado
        setTimeout(() => {
          reset();
        }, 500);
      },
      onError: (error) => {
        toast.error(error.message || "Erro ao desconectar canal");
      },
    }),
  );

  const handleDisconnect = () => {
    if (!channelId) return;
    disconnectMutation.mutate({ id: channelId });
  };

  return (
    <div className="flex flex-col items-start gap-6 py-6">
      {/* Situação */}
      <div>
        <p className="text-muted-foreground mb-2 text-sm">Situação</p>
        <h2 className="text-4xl font-bold text-green-600">Conectado</h2>
      </div>

      {/* Informações */}
      <div className="flex items-center gap-2 text-lg">
        <span className="font-medium">
          {channel?.displayName ? (
            <>
              {channel.displayName}
              {channel.phoneNumber && (
                <>
                  <ChevronRight className="text-muted-foreground mx-2 inline h-5 w-5" />
                  <span className="text-muted-foreground">
                    {formatBrazilianPhone(channel.phoneNumber)}
                  </span>
                </>
              )}
            </>
          ) : channel?.phoneNumber ? (
            formatBrazilianPhone(channel.phoneNumber)
          ) : (
            "Carregando..."
          )}
        </span>
      </div>

      {/* Botão desconectar */}
      <Button
        variant="destructive"
        size="lg"
        onClick={handleDisconnect}
        disabled={disconnectMutation.isPending}
      >
        <XCircle className="mr-2 h-5 w-5" />
        {disconnectMutation.isPending ? "desconectando..." : "desconectar"}
      </Button>

      {/* Botão voltar */}
      <button
        onClick={goBack}
        className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm"
      >
        <ChevronLeft className="h-4 w-4" />
        voltar
      </button>
    </div>
  );
}
