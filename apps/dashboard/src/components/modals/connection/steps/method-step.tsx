"use client";

import { ChevronLeft, ChevronRight, Phone, QrCode } from "lucide-react";

import { Button } from "@manylead/ui/button";

import { useConnectionModalStore } from "~/stores/use-connection-modal-store";

interface ConnectionMethod {
  id: "qr" | "pairing";
  title: string;
  description: string;
  icon: React.ReactNode;
}

const METHODS: ConnectionMethod[] = [
  {
    id: "qr",
    title: "Leitura de QR Code",
    description: "Escaneie o código QR com seu celular",
    icon: <QrCode />,
  },
  {
    id: "pairing",
    title: "Número do telefone",
    description: "Conecte usando código de emparelhamento",
    icon: <Phone />,
  },
];

export function MethodStep() {
  const { setMethod, setStep, goBack, reset } = useConnectionModalStore();

  const handleSelect = (methodId: (typeof METHODS)[number]["id"]) => {
    setMethod(methodId);
    setStep(methodId === "qr" ? "qrcode" : "pairing");
  };

  const handleSkip = () => {
    reset();
  };

  return (
    <div className="grid gap-6">
      <p className="text-muted-foreground text-center">
        Como deseja se conectar ao WhatsApp?
      </p>

      <div className="grid grid-cols-2 gap-4">
        {METHODS.map((method) => (
          <Button
            key={method.id}
            variant="outline"
            onClick={() => handleSelect(method.id)}
            className="flex h-auto flex-col items-center gap-4 p-8 [&_svg]:h-12! [&_svg]:w-12!"
          >
            {method.icon}
            <div className="text-center">
              <p className="font-semibold underline">{method.title}</p>
              <p className="text-muted-foreground mt-1 text-xs">
                {method.description}
              </p>
            </div>
          </Button>
        ))}
      </div>

      <div className="text-muted-foreground flex items-center justify-between text-sm">
        <button
          onClick={goBack}
          className="hover:text-foreground flex items-center gap-2"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="whitespace-nowrap">voltar</span>
        </button>

        <button
          onClick={handleSkip}
          className="hover:text-foreground flex items-center gap-2"
        >
          <span className="whitespace-nowrap">Pular esta etapa</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
