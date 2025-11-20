"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { FaWhatsapp } from "react-icons/fa";
import { toast } from "sonner";

import { cn } from "@manylead/ui";
import { Button } from "@manylead/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@manylead/ui/dialog";
import { Input } from "@manylead/ui/input";
import { Label } from "@manylead/ui/label";

import { useTRPC } from "~/lib/trpc/react";

type ChatType = "internal" | "whatsapp";

interface NewChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewChatDialog({ open, onOpenChange }: NewChatDialogProps) {
  const router = useRouter();
  const trpc = useTRPC();
  const [selectedType, setSelectedType] = useState<ChatType | null>(null);
  const [instanceCode, setInstanceCode] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  const createNewSessionMutation = useMutation(
    trpc.chats.createNewSession.mutationOptions({
      onSuccess: (chat) => {
        handleClose();
        router.push(`/chats/${chat.id}`);
      },
      onError: (error) => {
        toast.error("Erro ao criar chat", {
          description: error.message,
        });
      },
    }),
  );

  const handleStartChat = async () => {
    try {
      if (selectedType === "internal") {
        await createNewSessionMutation.mutateAsync({
          targetInstanceCode: instanceCode.trim(),
        });
      } else if (selectedType === "whatsapp") {
        // TODO: Implement WhatsApp chat creation
        console.log("Starting WhatsApp chat with number:", phoneNumber);
        toast("Em breve", {
          description: "Criação de chat WhatsApp será implementada em breve.",
        });
      }
    } catch (error) {
      // Error already handled by onError
      console.error("Failed to start chat:", error);
    }
  };

  const handleClose = () => {
    setSelectedType(null);
    setInstanceCode("");
    setPhoneNumber("");
    onOpenChange(false);
  };

  const handleBack = () => {
    setSelectedType(null);
    setInstanceCode("");
    setPhoneNumber("");
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {!selectedType ? (
          <>
            <DialogHeader>
              <DialogTitle>Iniciar conversa</DialogTitle>
            </DialogHeader>

            <div className="space-y-2">
              <NewChatOption
                icon={<span className="text-sm font-bold">ML</span>}
                label="Manylead"
                description="Conversa interna com outro usuário"
                onClick={() => setSelectedType("internal")}
              />

              <NewChatOption
                icon={<FaWhatsapp className="text-foreground h-6 w-6" />}
                label="WhatsApp"
                description="Iniciar conversa no WhatsApp"
                onClick={() => setSelectedType("whatsapp")}
              />
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>
                {selectedType === "internal"
                  ? "Conversa interna - ManyLead"
                  : "Nova conversa - WhatsApp"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {selectedType === "internal" ? (
                <div className="space-y-2">
                  <Label htmlFor="instance-code">Código da instância</Label>
                  <Input
                    id="instance-code"
                    placeholder="manylead-xxxxxxxxxx"
                    value={instanceCode}
                    onChange={(e) => setInstanceCode(e.target.value)}
                    autoFocus
                  />
                  <p className="text-muted-foreground text-xs">
                    Digite o código da pessoa com quem deseja conversar
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="phone-number">Número de telefone</Label>
                  <Input
                    id="phone-number"
                    placeholder="+55 11 99999-9999"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    autoFocus
                  />
                  <p className="text-muted-foreground text-xs">
                    Digite o número com DDD (ex: +55 11 99999-9999)
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleBack}
                  className="flex-1"
                  disabled={createNewSessionMutation.isPending}
                >
                  Voltar
                </Button>
                <Button
                  onClick={handleStartChat}
                  className="flex-1"
                  disabled={
                    createNewSessionMutation.isPending ||
                    (selectedType === "internal" && !instanceCode.trim()) ||
                    (selectedType === "whatsapp" && !phoneNumber.trim())
                  }
                >
                  {createNewSessionMutation.isPending
                    ? "Iniciando..."
                    : "Iniciar conversa"}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function NewChatOption({
  icon,
  label,
  description,
  onClick,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  description?: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "hover:bg-accent flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-colors",
        className,
      )}
    >
      <div className="shrink-0">{icon}</div>

      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{label}</div>
        {description && (
          <p className="text-muted-foreground text-xs">{description}</p>
        )}
      </div>
    </button>
  );
}
