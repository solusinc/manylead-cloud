"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { useTRPC } from "~/lib/trpc/react";
import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "~/components/content/section";
import { Card, CardContent } from "@manylead/ui/card";
import { Button } from "@manylead/ui/button";
import { Badge } from "@manylead/ui/badge";
import { Loader2, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import { useEffect } from "react";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const trpc = useTRPC();

  // Buscar dados do canal
  const { data: channel, isLoading: channelLoading } = useQuery(
    trpc.channels.getById.queryOptions({ id }),
  );

  // Buscar QR code (com polling a cada 3 segundos enquanto pending)
  const {
    data: qrData,
    isLoading: qrLoading,
    refetch: refetchQR,
  } = useQuery({
    ...trpc.channels.getQRCode.queryOptions({ id }),
    refetchInterval: (query) => {
      const data = query.state.data;
      // Se está pendente ou se o QR existe mas não conectou, fazer polling
      if (!data) return 3000;
      if (data.status === "pending" || data.status === "error") return 3000;
      return false;
    },
  });

  // Verificar status de conexão (polling a cada 5 segundos)
  const { data: connectionStatus, refetch: refetchStatus } = useQuery({
    ...trpc.channels.checkConnection.queryOptions({ id }),
    refetchInterval: 5000,
  });

  // Redirecionar se conectado com sucesso
  useEffect(() => {
    if (connectionStatus?.status === "connected") {
      setTimeout(() => {
        router.push("/settings/channels");
      }, 2000);
    }
  }, [connectionStatus, router]);

  if (channelLoading || qrLoading) {
    return (
      <SectionGroup>
        <Section>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </Section>
      </SectionGroup>
    );
  }

  if (!channel) {
    return (
      <SectionGroup>
        <Section>
          <SectionHeader>
            <SectionTitle>Canal não encontrado</SectionTitle>
          </SectionHeader>
        </Section>
      </SectionGroup>
    );
  }

  const getStatusBadge = () => {
    const status = connectionStatus?.status ?? channel.status;

    switch (status) {
      case "connected":
        return (
          <Badge variant="default" className="gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Conectado
          </Badge>
        );
      case "error":
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            Erro
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="secondary" className="gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Aguardando conexão
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <div className="flex items-center justify-between">
            <div>
              <SectionTitle>{channel.displayName}</SectionTitle>
              <SectionDescription>
                Escaneie o QR Code abaixo com o WhatsApp do seu celular para
                conectar o canal.
              </SectionDescription>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge()}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void refetchQR();
                  void refetchStatus();
                }}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </SectionHeader>

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            {connectionStatus?.status === "connected" ? (
              <div className="text-center">
                <CheckCircle2 className="text-green-500 mx-auto mb-4 h-16 w-16" />
                <h3 className="mb-2 text-lg font-semibold">
                  Canal conectado com sucesso!
                </h3>
                <p className="text-muted-foreground text-sm">
                  Redirecionando para a lista de canais...
                </p>
              </div>
            ) : qrData?.expired ? (
              <div className="text-center">
                <XCircle className="text-destructive mx-auto mb-4 h-16 w-16" />
                <h3 className="mb-2 text-lg font-semibold">QR Code expirado</h3>
                <p className="text-muted-foreground mb-4 text-sm">
                  O QR Code expirou. Clique no botão abaixo para gerar um novo.
                </p>
                <Button onClick={() => void refetchQR()}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Gerar novo QR Code
                </Button>
              </div>
            ) : qrData?.qrCode ? (
              <div className="text-center">
                <div className="bg-white mb-4 inline-block rounded-lg p-4">
                  <Image
                    src={qrData.qrCode}
                    alt="QR Code WhatsApp"
                    width={256}
                    height={256}
                    className="h-64 w-64"
                    unoptimized
                  />
                </div>
                <h3 className="mb-2 text-lg font-semibold">
                  Escaneie o QR Code
                </h3>
                <ol className="text-muted-foreground space-y-1 text-left text-sm">
                  <li>1. Abra o WhatsApp no seu celular</li>
                  <li>2. Toque em Mais opções ou Configurações</li>
                  <li>3. Toque em Dispositivos conectados</li>
                  <li>4. Toque em Conectar um dispositivo</li>
                  <li>5. Aponte seu celular para esta tela</li>
                </ol>
              </div>
            ) : (
              <div className="text-center">
                <Loader2 className="text-muted-foreground mx-auto mb-4 h-16 w-16 animate-spin" />
                <h3 className="mb-2 text-lg font-semibold">
                  Gerando QR Code...
                </h3>
                <p className="text-muted-foreground text-sm">
                  Aguarde enquanto o QR Code é gerado
                </p>
              </div>
            )}

            {connectionStatus?.errorMessage && (
              <div className="bg-destructive/10 text-destructive mt-4 rounded-lg p-4">
                <p className="text-sm">{connectionStatus.errorMessage}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-4 flex justify-end">
          <Button
            variant="outline"
            onClick={() => router.push("/settings/channels")}
          >
            Voltar para lista
          </Button>
        </div>
      </Section>
    </SectionGroup>
  );
}
