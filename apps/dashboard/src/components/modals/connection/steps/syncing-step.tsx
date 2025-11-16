"use client";

import { useEffect } from "react";
import { ChevronLeft, ArrowRight } from "lucide-react";
import { Button } from "@manylead/ui/button";
import { useQuery } from "@tanstack/react-query";

import { useConnectionModalStore } from "~/stores/use-connection-modal-store";
import { useTRPC } from "~/lib/trpc/react";

export function SyncingStep() {
  const { goBack, reset, channelId } = useConnectionModalStore();
  const trpc = useTRPC();

  // Buscar dados do canal para verificar syncStatus
  const { data: channel } = useQuery({
    ...trpc.channels.getById.queryOptions({ id: channelId ?? "" }),
    enabled: !!channelId,
    refetchInterval: 2000, // Refetch a cada 2 segundos para pegar atualizações
  });

  // Quando sync completar, fechar modal
  useEffect(() => {
    if (channel?.syncStatus === "completed") {
      // Aguardar um pouco antes de fechar
      setTimeout(() => {
        reset();
      }, 1000);
    }
  }, [channel?.syncStatus, reset]);

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-8">
      {/* Loader animado do WhatsApp */}
      <div className="relative">
        <svg
          className="animate-spin"
          width="120"
          height="120"
          viewBox="0 0 120 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle
            cx="60"
            cy="60"
            r="54"
            stroke="#E5E7EB"
            strokeWidth="4"
          />
          <path
            d="M 60,6 A 54,54 0 0,1 114,60"
            stroke="#25D366"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12 2C6.48 2 2 6.48 2 12C2 13.54 2.37 15 3.03 16.29L2 22L7.96 20.97C9.23 21.57 10.61 21.92 12 21.92C17.52 21.92 22 17.44 22 11.92C22 6.4 17.52 2 12 2ZM16.71 15.29C16.53 15.86 15.62 16.36 15.11 16.43C14.66 16.49 14.1 16.51 13.5 16.29C13.14 16.15 12.68 15.97 12.11 15.69C9.82 14.62 8.33 12.31 8.21 12.15C8.09 11.99 7.27 10.88 7.27 9.72C7.27 8.56 7.87 7.99 8.09 7.75C8.31 7.51 8.57 7.45 8.75 7.45C8.82 7.45 8.88 7.45 8.94 7.45C9.16 7.45 9.28 7.46 9.42 7.82C9.64 8.37 10.14 9.53 10.2 9.65C10.26 9.77 10.32 9.93 10.24 10.09C10.16 10.25 10.1 10.33 9.98 10.47C9.86 10.61 9.75 10.72 9.63 10.88C9.52 11.02 9.4 11.17 9.54 11.41C9.68 11.65 10.13 12.42 10.81 13.02C11.67 13.78 12.39 14.02 12.65 14.14C12.91 14.26 13.05 14.24 13.19 14.08C13.33 13.92 13.81 13.37 13.97 13.13C14.13 12.89 14.29 12.93 14.51 13.01C14.73 13.09 15.89 13.66 16.13 13.78C16.37 13.9 16.53 13.96 16.59 14.06C16.65 14.16 16.65 14.71 16.47 15.28L16.71 15.29Z"
              fill="#25D366"
            />
          </svg>
        </div>
      </div>

      {/* Textos */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Sincronizando suas mensagens</h2>
        <p className="text-muted-foreground">
          Este processo pode levar alguns minutos. Você será redirecionado automaticamente.
        </p>
      </div>

      {/* Botões */}
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Button
          variant="default"
          size="lg"
          onClick={reset}
          className="w-full"
        >
          seguir para o chat
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>

        <button
          onClick={goBack}
          className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          voltar
        </button>
      </div>
    </div>
  );
}
