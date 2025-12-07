"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useMutation, useQuery } from "@tanstack/react-query";
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
  const [organizationInstanceCode, setOrganizationInstanceCode] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  // Check if has connected WhatsApp channel
  const { data: hasConnectedChannel = false } = useQuery({
    ...trpc.channels.hasConnectedChannel.queryOptions(),
    enabled: open, // Only fetch when dialog is open
  });

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

  const createWhatsAppChatMutation = useMutation(
    trpc.chats.createWhatsAppChat.mutationOptions({
      onSuccess: (chat) => {
        handleClose();
        router.push(`/chats/${chat.id}`);
        toast.success("Chat iniciado", {
          description: "Conversa WhatsApp criada com sucesso",
        });
      },
      onError: (error) => {
        // Tratamento especial para erro de canal não conectado
        if (error.message.includes("Nenhum canal")) {
          toast.error("Canal não conectado", {
            description: error.message,
            action: {
              label: "Configurar",
              onClick: () => {
                handleClose();
                router.push("/settings/channels");
              },
            },
          });
        } else {
          toast.error("Erro ao criar chat WhatsApp", {
            description: error.message,
          });
        }
      },
    }),
  );

  const handleStartChat = async () => {
    try {
      if (selectedType === "internal") {
        await createNewSessionMutation.mutateAsync({
          organizationInstanceCode: organizationInstanceCode.trim(),
        });
      } else if (selectedType === "whatsapp") {
        await createWhatsAppChatMutation.mutateAsync({
          phoneNumber: phoneNumber.trim(),
        });
      }
    } catch (error) {
      // Error already handled by onError
      console.error("Failed to start chat:", error);
    }
  };

  const handleClose = () => {
    setSelectedType(null);
    setOrganizationInstanceCode("");
    setPhoneNumber("");
    onOpenChange(false);
  };

  const handleBack = () => {
    setSelectedType(null);
    setOrganizationInstanceCode("");
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
                  <>
                    <Image
                      src="/assets/manylead-icon-light.png"
                      alt="ManyLead"
                      width={24}
                      height={24}
                      className="dark:hidden"
                    />
                    <Image
                      src="/assets/manylead-icon-dark.png"
                      alt="ManyLead"
                      width={24}
                      height={24}
                      className="hidden dark:block"
                    />
                  </>
                }
                label="Manylead"
                description="Conversa com outra organização"
                onClick={() => setSelectedType("internal")}
              />

              <NewChatOption
                icon={<FaWhatsapp className="text-foreground h-6 w-6" />}
                label="WhatsApp"
                description={
                  hasConnectedChannel
                    ? "Iniciar conversa no WhatsApp"
                    : "Configure um canal WhatsApp primeiro"
                }
                onClick={() => {
                  if (hasConnectedChannel) {
                    setSelectedType("whatsapp");
                  } else {
                    handleClose();
                    router.push("/settings/channels");
                  }
                }}
                disabled={!hasConnectedChannel}
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
                  <Label htmlFor="instance-code">Código da organização</Label>
                  <Input
                    id="instance-code"
                    placeholder="manylead-xxxxxxxxxx"
                    value={organizationInstanceCode}
                    onChange={(e) => setOrganizationInstanceCode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && organizationInstanceCode.trim() && !createNewSessionMutation.isPending) {
                        void handleStartChat();
                      }
                    }}
                    autoFocus
                  />
                  <p className="text-muted-foreground text-xs">
                    Digite o código da organização com quem deseja conversar
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
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && phoneNumber.trim() && !createWhatsAppChatMutation.isPending) {
                        void handleStartChat();
                      }
                    }}
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
                  disabled={createNewSessionMutation.isPending || createWhatsAppChatMutation.isPending}
                >
                  Voltar
                </Button>
                <Button
                  onClick={handleStartChat}
                  className="flex-1"
                  disabled={
                    createNewSessionMutation.isPending ||
                    createWhatsAppChatMutation.isPending ||
                    (selectedType === "internal" && !organizationInstanceCode.trim()) ||
                    (selectedType === "whatsapp" && !phoneNumber.trim())
                  }
                >
                  {(createNewSessionMutation.isPending || createWhatsAppChatMutation.isPending)
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
  disabled = false,
}: {
  icon: React.ReactNode;
  label: string;
  description?: string;
  onClick: () => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "hover:bg-accent flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-colors",
        disabled && "cursor-not-allowed opacity-50 hover:bg-transparent",
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
