"use client";

import { useState } from "react";
import { FaWhatsapp, FaFacebook, FaInstagram } from "react-icons/fa";

import { useConnectionModalStore } from "~/stores/use-connection-modal-store";
import { useChannelSocket } from "~/hooks/use-channel-socket";
import { ConnectionModal } from "./connection-modal";
import {
  ActionCard,
  ActionCardDescription,
  ActionCardHeader,
} from "~/components/content/action-card";

export function ConnectionBanner() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { setStep } = useConnectionModalStore();
  const { status } = useChannelSocket();

  const hasConnectedChannel = status === "connected";

  const handleClick = () => {
    if (hasConnectedChannel) {
      setStep("connected");
    } else {
      setStep("network");
    }
    setIsModalOpen(true);
  };

  return (
    <>
      <div className="mb-6" onClick={handleClick}>
        <ActionCard className="hover:bg-accent h-full w-full cursor-pointer transition-colors">
          <ActionCardHeader>
            <div className="flex items-center gap-4">
              {/* Ícones das redes - lado a lado sem sobreposição */}
              <div className="flex items-center gap-3">
                <FaWhatsapp className="h-6 w-6 shrink-0 text-muted-foreground" />
                <FaFacebook className="h-6 w-6 shrink-0 text-muted-foreground" />
                <FaInstagram className="h-6 w-6 shrink-0 text-muted-foreground" />
              </div>

              {/* Texto */}
              <div className="flex flex-col gap-1">
                <ActionCardDescription>
                  Conecte a Manylead à sua conta do WhatsApp, Facebook ou Instagram.
                </ActionCardDescription>
              </div>
            </div>
          </ActionCardHeader>
        </ActionCard>
      </div>

      <ConnectionModal open={isModalOpen} onOpenChange={setIsModalOpen} />
    </>
  );
}
