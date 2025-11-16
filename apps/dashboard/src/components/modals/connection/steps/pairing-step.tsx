"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, ArrowRight, Loader2, MoreVertical, Settings } from "lucide-react";
import { Button } from "@manylead/ui/button";
import { Input } from "@manylead/ui/input";
import { toast } from "sonner";
import { useMutation, useQuery } from "@tanstack/react-query";

import { useConnectionModalStore } from "~/stores/use-connection-modal-store";
import { useChannelSocket } from "~/hooks/use-channel-socket";
import { useTRPC } from "~/lib/trpc/react";

export function PairingStep() {
  const { goBack, setPhoneNumber, setStep, channelId, setChannelId } = useConnectionModalStore();
  const { status, isConnected, connect } = useChannelSocket();
  const trpc = useTRPC();
  const hasCreatedChannelRef = useRef(false);

  const [countryCode, setCountryCode] = useState("+55");
  const [phone, setPhone] = useState("");
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Obter organização atual
  const { data: currentOrg } = useQuery(trpc.organization.getCurrent.queryOptions());

  // Buscar canal existente do tipo qr_code (sempre busca para verificar status)
  const { data: existingChannel, isLoading: isLoadingChannel } = useQuery({
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

  // Criar canal se não existir - mas só se já terminou de buscar o existente
  useEffect(() => {
    // Se já tem channelId definido, não precisa criar
    if (channelId) return;

    // Se ainda está carregando, aguardar
    if (isLoadingChannel) return;

    // Se já existe um canal, usar ele ao invés de criar novo
    if (existingChannel) return;

    // Criar novo canal apenas se realmente não existe nenhum
    createChannel();
  }, [channelId, existingChannel, isLoadingChannel, createChannel]);

  // Mutation para conectar via pairing code
  const connectPairingMutation = useMutation(
    trpc.channels.connectPairingCode.mutationOptions({
      onSuccess: (data) => {
        setPairingCode(data.pairingCode);
        setIsSubmitting(false);
      },
      onError: (error) => {
        toast.error(error.message || "Erro ao gerar código de emparelhamento");
        setIsSubmitting(false);
      },
    })
  );

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

  const handleSubmit = async () => {
    if (!channelId) {
      toast.error("ID do canal não encontrado");
      return;
    }

    const fullNumber = `${countryCode}${phone}`.replace(/\D/g, "");
    setPhoneNumber(fullNumber);
    setIsSubmitting(true);

    try {
      await connectPairingMutation.mutateAsync({
        id: channelId,
        phoneNumber: fullNumber,
      });
    } catch {
      // Error já tratado no onError do mutation
    }
  };

  const formatPhoneNumber = (value: string) => {
    const numbers = value.replace(/\D/g, "");

    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    if (numbers.length <= 11) {
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
    }
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  // Se já tiver código, mostrar layout diferente
  if (pairingCode) {
    // Formatar código com hífen no meio (ex: 9SN5-658G)
    const formattedCode = pairingCode.length === 8
      ? `${pairingCode.slice(0, 4)}-${pairingCode.slice(4)}`
      : pairingCode;

    return (
      <div className="grid gap-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          {/* Lado esquerdo - Instruções */}
          <div className="space-y-4">
            <ol className="space-y-3 text-sm text-muted-foreground list-decimal list-inside">
              <li>Abra o WhatsApp no seu celular</li>
              <li>
                Toque em <strong className="inline-flex items-center gap-1">Mais opções <MoreVertical className="inline h-3 w-3" /></strong> ou{" "}
                <strong className="inline-flex items-center gap-1">Configurações <Settings className="inline h-3 w-3" /></strong>
              </li>
              <li>
                Toque em <strong>Dispositivos conectados</strong> e, em seguida,
                em <strong>Conectar dispositivo</strong>
              </li>
              <li>
                Toque em <strong>Conectar com número de telefone</strong> e
                insira o código exibido no seu celular.
              </li>
            </ol>
          </div>

          {/* Lado direito - Código */}
          <div className="flex flex-col items-center justify-center gap-3">
            <div className="rounded-lg border p-4 bg-background">
              <p className="text-3xl font-bold tracking-[0.15em] text-center">
                {formattedCode}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ChevronLeft className="h-4 w-4" />
          <button onClick={goBack} className="hover:text-foreground">
            voltar
          </button>
        </div>
      </div>
    );
  }

  // Layout para inserir o telefone
  return (
    <div className="grid gap-6">
      <div className="text-center">
        <p className="text-muted-foreground">
          Insira o código do país e o número do telefone conectado ao WhatsApp
        </p>
      </div>

      <div className="flex items-end justify-center gap-3">
        <Input
          value={countryCode}
          onChange={(e) => setCountryCode(e.target.value)}
          placeholder="+55"
          className="w-24 text-center text-xl"
          disabled={isSubmitting}
        />
        <Input
          value={phone}
          onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
          placeholder="(11) 98888-4444"
          className="flex-1 text-xl"
          disabled={isSubmitting}
        />
        <Button
          onClick={() => void handleSubmit()}
          disabled={phone.replace(/\D/g, "").length < 10 || isSubmitting}
          size="lg"
        >
          {isSubmitting ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <ArrowRight className="h-5 w-5" />
          )}
        </Button>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <ChevronLeft className="h-4 w-4" />
        <button onClick={goBack} className="hover:text-foreground">
          voltar
        </button>
      </div>
    </div>
  );
}
