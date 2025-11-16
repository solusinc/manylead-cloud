"use client";

import { useState } from "react";
import { FaWhatsapp } from "react-icons/fa";

import { cn } from "@manylead/ui";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@manylead/ui/dialog";
import { Input } from "@manylead/ui/input";
import { Button } from "@manylead/ui/button";
import { Label } from "@manylead/ui/label";

type ChatType = "internal" | "whatsapp";

interface NewChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewChatDialog({ open, onOpenChange }: NewChatDialogProps) {
  const [selectedType, setSelectedType] = useState<ChatType | null>(null);
  const [instanceCode, setInstanceCode] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleStartChat = () => {
    setIsLoading(true);

    try {
      if (selectedType === "internal") {
        // TODO: Implement internal chat creation
        console.log("Starting internal chat with code:", instanceCode);
      } else if (selectedType === "whatsapp") {
        // TODO: Implement WhatsApp chat creation
        console.log("Starting WhatsApp chat with number:", phoneNumber);
      }

      // Reset and close
      handleClose();
    } catch (error) {
      console.error("Failed to start chat:", error);
    } finally {
      setIsLoading(false);
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
                icon={
                  <span className="text-sm font-bold">ML</span>
                }
                label="Manylead"
                description="Conversa interna com outro usuário"
                onClick={() => setSelectedType("internal")}
              />

              <NewChatOption
                icon={<FaWhatsapp className="h-6 w-6 text-foreground" />}
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
                  <p className="text-xs text-muted-foreground">
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
                  <p className="text-xs text-muted-foreground">
                    Digite o número com DDD (ex: +55 11 99999-9999)
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleBack}
                  className="flex-1"
                  disabled={isLoading}
                >
                  Voltar
                </Button>
                <Button
                  onClick={handleStartChat}
                  className="flex-1"
                  disabled={
                    isLoading ||
                    (selectedType === "internal" && !instanceCode.trim()) ||
                    (selectedType === "whatsapp" && !phoneNumber.trim())
                  }
                >
                  {isLoading ? "Iniciando..." : "Iniciar conversa"}
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
        "w-full flex items-center gap-3 p-4 rounded-lg border hover:bg-accent transition-colors text-left",
        className
      )}
    >
      <div className="flex-shrink-0">{icon}</div>

      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm">{label}</div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
    </button>
  );
}
