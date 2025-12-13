"use client";

import { useState } from "react";
import { User, MessageCircle } from "lucide-react";
import { cn } from "@manylead/ui";
import { Button } from "@manylead/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@manylead/ui/dialog";
import { useTRPC } from "~/lib/trpc/react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { usePhoneDisplay } from "~/hooks/use-phone-display";

interface ContactData {
  displayName?: string;
  vcard?: string;
  contacts?: {
    displayName: string;
    vcard: string;
  }[];
}

/**
 * Parse vCard para extrair informações do contato
 */
function parseVCard(vcard: string): { phoneNumber?: string; email?: string } {
  const phoneRegex = /TEL[^:]*:([^\n\r]+)/i;
  const emailRegex = /EMAIL[^:]*:([^\n\r]+)/i;

  const phoneMatch = phoneRegex.exec(vcard);
  const emailMatch = emailRegex.exec(vcard);

  return {
    phoneNumber: phoneMatch?.[1]?.trim().replace(/\D/g, ""),
    email: emailMatch?.[1]?.trim(),
  };
}

/**
 * Componente de preview para mensagens de contato
 */
export function ChatMessageContact({
  metadata,
  isOutgoing,
}: {
  metadata: Record<string, unknown>;
  isOutgoing: boolean;
}) {
  const trpc = useTRPC();
  const router = useRouter();
  const { formatPhone } = usePhoneDisplay();

  const contactData = metadata as ContactData;

  // Mutation para criar chat WhatsApp com o contato
  const createChatMutation = useMutation(
    trpc.chats.createWhatsAppChat.mutationOptions({
      onSuccess: (chat) => {
        // Redirecionar para o novo chat
        router.push(`/chats/${chat.id}`);
      },
    })
  );

  const handleSendMessage = (phoneNumber: string) => {
    createChatMutation.mutate({ phoneNumber });
  };

  if (!contactData.displayName && !contactData.contacts) {
    return null;
  }

  // Se for múltiplos contatos
  if (contactData.contacts && contactData.contacts.length > 1) {
    const firstName = contactData.contacts[0]?.displayName ?? "Contato";
    const othersCount = contactData.contacts.length - 1;

    return (
      <div className={cn(
        "min-w-[280px] max-w-[360px] overflow-hidden rounded-2xl border",
        isOutgoing
          ? "border-msg-outgoing-border bg-msg-outgoing/10"
          : "border-border bg-background"
      )}>
        <div className="p-4">
          {/* Header com ícone e texto */}
          <div className="flex items-start gap-3 mb-3">
            <div className={cn(
              "flex size-14 shrink-0 items-center justify-center rounded-full",
              isOutgoing ? "bg-msg-outgoing/40" : "bg-muted"
            )}>
              <User className="size-7 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <p className="font-semibold text-base truncate">{firstName}</p>
              <p className="text-sm text-muted-foreground">
                e outros {othersCount} contato{othersCount > 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Botão Ver todos */}
          <ContactsModal
            contacts={contactData.contacts}
            isOutgoing={isOutgoing}
          />
        </div>
      </div>
    );
  }

  // Contato único
  const vcard = contactData.vcard ?? contactData.contacts?.[0]?.vcard;
  const displayName = contactData.displayName ?? contactData.contacts?.[0]?.displayName;
  const { phoneNumber } = vcard ? parseVCard(vcard) : {};

  return (
    <div className={cn(
      "min-w-[280px] max-w-[360px] overflow-hidden rounded-2xl border",
      isOutgoing
        ? "border-msg-outgoing-border bg-msg-outgoing/10"
        : "border-border bg-background"
    )}>
      <div className="p-4">
        {/* Header com ícone e nome */}
        <div className="flex items-start gap-3 mb-3">
          <div className={cn(
            "flex size-14 shrink-0 items-center justify-center rounded-full",
            isOutgoing ? "bg-msg-outgoing/40" : "bg-muted"
          )}>
            <User className="size-7 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0 pt-1">
            <p className="font-semibold text-base truncate">{displayName}</p>
            {phoneNumber && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {formatPhone(phoneNumber)}
              </p>
            )}
          </div>
        </div>

        {/* Botão de enviar mensagem */}
        {phoneNumber && (
          <Button
            variant={isOutgoing ? "secondary" : "default"}
            size="sm"
            onClick={() => handleSendMessage(phoneNumber)}
            disabled={createChatMutation.isPending}
            className="w-full"
          >
            <MessageCircle className="mr-2 size-4" />
            {createChatMutation.isPending ? "Abrindo..." : "Enviar mensagem"}
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Modal para exibir múltiplos contatos
 */
function ContactsModal({
  contacts,
  isOutgoing,
}: {
  contacts: { displayName: string; vcard: string }[];
  isOutgoing: boolean;
}) {
  const [open, setOpen] = useState(false);
  const trpc = useTRPC();
  const router = useRouter();
  const { formatPhone } = usePhoneDisplay();

  const createChatMutation = useMutation(
    trpc.chats.createWhatsAppChat.mutationOptions({
      onSuccess: (chat) => {
        setOpen(false); // Fechar modal
        router.push(`/chats/${chat.id}`);
      },
    })
  );

  const handleSendMessage = (phoneNumber: string) => {
    createChatMutation.mutate({ phoneNumber });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={isOutgoing ? "secondary" : "default"}
          size="sm"
          className="w-full"
        >
          Ver todos
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{contacts.length} Contatos</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {contacts.map((contact, index) => {
            const { phoneNumber } = parseVCard(contact.vcard);
            return (
              <div
                key={index}
                className="flex items-center gap-3 p-3 rounded-lg border bg-muted/50"
              >
                <div className={cn(
                  "flex size-12 shrink-0 items-center justify-center rounded-full",
                  isOutgoing ? "bg-msg-outgoing/40" : "bg-muted"
                )}>
                  <User className="size-6 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{contact.displayName}</p>
                  {phoneNumber && (
                    <p className="text-sm text-muted-foreground">
                      {formatPhone(phoneNumber)}
                    </p>
                  )}
                </div>
                {phoneNumber && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleSendMessage(phoneNumber)}
                    disabled={createChatMutation.isPending}
                  >
                    <MessageCircle className="mr-2 size-4" />
                    Enviar
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
