"use client";

import { useEffect } from "react";
import { FaWhatsapp, FaFacebook, FaInstagram } from "react-icons/fa";
import { Button } from "@manylead/ui/button";
import { Badge } from "@manylead/ui/badge";
import { Skeleton } from "@manylead/ui/skeleton";
import { useQuery } from "@tanstack/react-query";

import { useConnectionModalStore } from "~/stores/use-connection-modal-store";
import {
  ActionCard,
  ActionCardDescription,
  ActionCardHeader,
  ActionCardTitle,
} from "~/components/content/action-card";
import { useTRPC } from "~/lib/trpc/react";
import { useChannelSocket } from "~/hooks/use-channel-socket";

interface NetworkOption {
  id: "whatsapp" | "whatsapp_official" | "facebook" | "instagram";
  name: string;
  description: string;
  icon: React.ReactNode;
  enabled: boolean;
}

const NETWORKS: NetworkOption[] = [
  {
    id: "whatsapp",
    name: "WhatsApp",
    description: "Conecte seu WhatsApp. Semelhante ao WhatsApp Web.",
    icon: <FaWhatsapp className="h-6 w-6 text-green-600" />,
    enabled: true,
  },
  {
    id: "whatsapp_official",
    name: "WhatsApp Oficial",
    description: "Conta oficial WhatsApp Cloud API.",
    icon: <FaWhatsapp className="h-6 w-6 text-muted-foreground" />,
    enabled: false,
  },
  {
    id: "facebook",
    name: "Facebook Messenger",
    description: "Conecte suas contas Facebook Messenger.",
    icon: <FaFacebook className="h-6 w-6 text-blue-600" />,
    enabled: false,
  },
  {
    id: "instagram",
    name: "Instagram Direct",
    description: "Conecte suas contas Instagram Direct.",
    icon: <FaInstagram className="h-6 w-6 text-pink-600" />,
    enabled: false,
  },
];

export function NetworkStep() {
  const { setNetwork, setStep, setChannelId } = useConnectionModalStore();
  const trpc = useTRPC();
  const { status } = useChannelSocket();

  // Buscar canal WhatsApp QR Code
  const { data: whatsappChannel, refetch, isLoading } = useQuery({
    ...trpc.channels.getByType.queryOptions({ channelType: "qr_code" }),
  });

  // Refetch quando o status do socket mudar
  useEffect(() => {
    void refetch();
  }, [status, refetch]);

  const handleSelect = (networkId: typeof NETWORKS[number]["id"]) => {
    // Se for WhatsApp e já estiver conectado, verificar syncStatus
    if (networkId === "whatsapp" && whatsappChannel?.status === "connected") {
      setNetwork(networkId);
      setChannelId(whatsappChannel.id);

      // Se sync não completou, vai para "syncing", senão vai para "connected"
      if (whatsappChannel.syncStatus !== "completed") {
        setStep("syncing");
      } else {
        setStep("connected");
      }
      return;
    }

    setNetwork(networkId);
    setStep("method");
  };

  return (
    <div className="grid gap-4">
      <div className="grid gap-3">
        {NETWORKS.map((network) => (
          <ActionCard
            key={network.id}
            className="hover:bg-accent h-full w-full transition-colors cursor-pointer"
            onClick={() =>
              network.enabled ? handleSelect(network.id) : undefined
            }
          >
            <ActionCardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                <div className="flex gap-3">
                  <div className="flex items-center justify-center">
                    {network.icon}
                  </div>
                  <div className="flex flex-col gap-1">
                    <ActionCardTitle>{network.name}</ActionCardTitle>
                    <ActionCardDescription>
                      {network.description}
                    </ActionCardDescription>
                  </div>
                </div>

                <div className="flex justify-center sm:justify-end sm:shrink-0">
                  {network.enabled ? (
                    network.id === "whatsapp" ? (
                      isLoading ? (
                        <Skeleton className="h-9 w-24" />
                      ) : whatsappChannel?.status === "connected" ? (
                        <Badge variant="default" className="bg-green-600">
                          Conectado
                        </Badge>
                      ) : (
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelect(network.id);
                          }}
                        >
                          Conectar
                        </Button>
                      )
                    ) : (
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelect(network.id);
                        }}
                      >
                        Conectar
                      </Button>
                    )
                  ) : (
                    <Badge variant="secondary">Em breve</Badge>
                  )}
                </div>
              </div>
            </ActionCardHeader>
          </ActionCard>
        ))}
      </div>
    </div>
  );
}
