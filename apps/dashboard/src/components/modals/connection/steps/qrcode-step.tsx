"use client";

import { useEffect, useCallback, useRef } from "react";
import { ChevronLeft, Loader2, MoreVertical, Settings } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "@manylead/ui/toast";

import { useConnectionModalStore } from "~/stores/use-connection-modal-store";
import { useChannelSocket } from "~/hooks/use-channel-socket";
import { useTRPC } from "~/lib/trpc/react";

export function QRCodeStep() {
  const { goBack, setStep, channelId, setChannelId } = useConnectionModalStore();
  const { qrCode: socketQrCode, status, isConnected, connect } = useChannelSocket();
  const trpc = useTRPC();
  const hasCreatedChannelRef = useRef(false);

  // Obter organização atual
  const { data: currentOrg } = useQuery(trpc.organization.getCurrent.queryOptions());

  // Buscar canal existente do tipo qr_code (sempre busca para verificar status)
  const { data: existingChannel } = useQuery({
    ...trpc.channels.getByType.queryOptions({ channelType: "qr_code" }),
  });

  // Mutation para criar canal
  const createChannelMutation = useMutation(
    trpc.channels.create.mutationOptions({
      onSuccess: (channel) => {
        setChannelId(channel.id);
      },
      onError: (error) => {
        toast.error(error.message || "Erro ao criar canal");
      },
    })
  );

  // Função estável para criar canal
  const createChannel = useCallback(() => {
    if (!hasCreatedChannelRef.current) {
      hasCreatedChannelRef.current = true;
      createChannelMutation.mutate({
        displayName: "WhatsApp",
        channelType: "qr_code",
      });
    }
  }, [createChannelMutation]);

  // Verificar status do canal existente e redirecionar se conectado
  useEffect(() => {
    if (!existingChannel) return;

    // Definir channelId se ainda não estiver definido
    if (!channelId) {
      setChannelId(existingChannel.id);
    }

    // Se já estiver conectado, verificar syncStatus
    if (existingChannel.status === "connected") {
      // Se sync já completou, vai para connected, senão vai para syncing
      if (existingChannel.syncStatus === "completed") {
        setStep("connected");
      } else {
        setStep("syncing");
      }
    }
  }, [existingChannel, channelId, setChannelId, setStep]);

  // Criar canal se não existir
  useEffect(() => {
    if (channelId || existingChannel) return;
    createChannel();
  }, [channelId, existingChannel, createChannel]);

  // Buscar QR Code do canal (somente se não estiver conectado)
  const { data: qrCodeData } = useQuery({
    ...trpc.channels.getQRCode.queryOptions({ id: channelId ?? "" }),
    enabled: !!channelId && existingChannel?.status !== "connected",
    retry: 3,
    retryDelay: 2000,
  });

  // Usar QR code do socket (atualizado em tempo real) ou do endpoint inicial
  const rawQrCode = socketQrCode ?? qrCodeData?.qrCode ?? null;

  // Remover prefixo data:image se já vier com ele
  const qrCode = rawQrCode
    ? rawQrCode.replace(/^data:image\/[a-z]+;base64,/, "")
    : null;

  // Conectar ao Socket.io ao montar
  useEffect(() => {
    if (!currentOrg?.id || isConnected) return;

    void connect(currentOrg.id);
  }, [connect, isConnected, currentOrg?.id]);

  // Quando conectar, ir para step "syncing"
  useEffect(() => {
    if (status === "connected") {
      setStep("syncing");
    }
  }, [status, setStep]);

  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Lado esquerdo - Instruções */}
        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Situação</p>
            <h2 className="text-3xl font-bold text-red-600">Desconectado</h2>
          </div>

          <ol className="space-y-3 text-sm">
            <li>
              <strong>1.</strong> Acesse o WhatsApp no celular que deseja conectar
            </li>
            <li>
              <strong>2.</strong> Clique em <strong className="inline-flex items-center gap-1">Ajustes <MoreVertical className="inline h-3 w-3" /></strong> ou <strong className="inline-flex items-center gap-1">Configurações <Settings className="inline h-3 w-3" /></strong> e selecione <strong>Aparelhos conectados</strong>.
            </li>
            <li>
              <strong>3.</strong> Clique <strong>Conectar um aparelho</strong> e aponte a câmera para o código <span className="hidden sm:inline">ao lado:</span><span className="sm:hidden">abaixo:</span>
            </li>
          </ol>
        </div>

        {/* Lado direito - QR Code */}
        <div className="flex flex-col items-center justify-center gap-3 sm:order-none order-last">
          <div className="rounded-lg border p-4">
            {!qrCode ? (
              <div className="flex h-48 w-48 items-center justify-center">
                <div className="text-center">
                  <Loader2 className="mx-auto h-12 w-12 animate-spin text-muted-foreground" />
                  <p className="mt-3 text-sm text-muted-foreground">
                    Aguarde enquanto geramos seu QR Code.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Pode levar até 3 minutos.
                  </p>
                </div>
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`data:image/png;base64,${qrCode}`}
                alt="QR Code"
                width={192}
                height={192}
                className="h-48 w-48"
                style={{
                  filter: 'grayscale(100%) contrast(200%)',
                }}
              />
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <ChevronLeft className="h-4 w-4" />
        <button onClick={goBack} className="hover:text-foreground">
          Voltar
        </button>
      </div>
    </div>
  );
}
