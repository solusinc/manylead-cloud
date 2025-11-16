"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@manylead/ui/dialog";
import { ChevronRight } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";

import { useConnectionModalStore } from "~/stores/use-connection-modal-store";
import { NetworkStep } from "./steps/network-step";
import { MethodStep } from "./steps/method-step";
import { QRCodeStep } from "./steps/qrcode-step";
import { PairingStep } from "./steps/pairing-step";
import { SyncingStep } from "./steps/syncing-step";
import { ConnectedStep } from "./steps/connected-step";

interface ConnectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConnectionModal({ open, onOpenChange }: ConnectionModalProps) {
  const { currentStep, reset } = useConnectionModalStore();

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
    if (!newOpen) {
      // Reset state when closing
      setTimeout(() => reset(), 300);
    }
  };

  const handleSkip = () => {
    onOpenChange(false);
    setTimeout(() => reset(), 300);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {currentStep === "network" && (
              <span className="text-base sm:text-lg">
                <span className="hidden sm:inline">Escolha as redes que deseja conectar à Manylead</span>
                <span className="sm:hidden">Conectar redes</span>
              </span>
            )}
            {currentStep === "method" && (
              <>
                <FaWhatsapp className="h-5 w-5 text-foreground" />
                WhatsApp
              </>
            )}
            {currentStep === "qrcode" && (
              <>
                <FaWhatsapp className="h-5 w-5 text-foreground" />
                WhatsApp
              </>
            )}
            {currentStep === "pairing" && (
              <>
                <FaWhatsapp className="h-5 w-5 text-foreground" />
                WhatsApp
              </>
            )}
            {currentStep === "syncing" && (
              <>
                <FaWhatsapp className="h-5 w-5 text-foreground" />
                WhatsApp
              </>
            )}
            {currentStep === "connected" && (
              <>
                <FaWhatsapp className="h-5 w-5 text-foreground" />
                WhatsApp
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Renderizar step baseado no estado */}
        {currentStep === "network" && <NetworkStep />}
        {currentStep === "method" && <MethodStep />}
        {currentStep === "qrcode" && <QRCodeStep />}
        {currentStep === "pairing" && <PairingStep />}
        {currentStep === "syncing" && <SyncingStep />}
        {currentStep === "connected" && <ConnectedStep />}

        {currentStep === "network" && (
          <DialogFooter className="sm:justify-end">
            <button
              onClick={handleSkip}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <span className="whitespace-nowrap">Pular esta etapa</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
