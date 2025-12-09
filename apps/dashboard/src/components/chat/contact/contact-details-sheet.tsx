"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, MessageCircle, Plus, Shield, ShieldCheck, X } from "lucide-react";
import { FaUser, FaUsers, FaWhatsapp } from "react-icons/fa";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@manylead/ui/avatar";
import { Button } from "@manylead/ui/button";
import { Input } from "@manylead/ui/input";
import { Label } from "@manylead/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@manylead/ui/sheet";
import { Skeleton } from "@manylead/ui/skeleton";
import { Textarea } from "@manylead/ui/textarea";
import { useTRPC } from "~/lib/trpc/react";
import { usePhoneDisplay } from "~/hooks/use-phone-display";

interface ContactDetailsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: {
    id: string;
    name: string;
    phoneNumber: string | null;
    avatar: string | null;
    instanceCode?: string;
    customName?: string | null;
    notes?: string | null;
    customFields?: Record<string, string> | null;
    isGroup?: boolean;
    groupJid?: string | null;
  };
  source?: "whatsapp" | "internal";
}

export function ContactDetailsSheet({
  open,
  onOpenChange,
  contact,
  source = "whatsapp",
}: ContactDetailsSheetProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Inicializar campos do banco
  const [customName, setCustomName] = useState(contact.customName ?? "");
  const [notes, setNotes] = useState(contact.notes ?? "");

  // Inicializar customFields do banco
  const initialCustomFields = contact.customFields ?? {};
  const [customFields, setCustomFields] = useState<
    { id: string; label: string; value: string }[]
  >(
    Object.entries(initialCustomFields).map(([label, value], index) => ({
      id: String(index),
      label,
      value,
    })),
  );

  const handleAddField = () => {
    const newFieldNumber = customFields.length + 1;
    setCustomFields([
      ...customFields,
      {
        id: String(newFieldNumber),
        label: `Campo-${newFieldNumber}`,
        value: "",
      },
    ]);
  };

  const updateMutation = useMutation(
    trpc.contacts.update.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: [["chats"]] });
        void queryClient.invalidateQueries({ queryKey: [["contacts"]] });
        toast.success("Contato atualizado com sucesso!");
        onOpenChange(false);
      },
      onError: (error) => {
        toast.error(error.message || "Erro ao atualizar contato");
      },
    }),
  );

  const handleSave = () => {
    // Converter customFields array para objeto
    const customFieldsObject = customFields.reduce(
      (acc, field) => {
        if (field.label && field.value) {
          acc[field.label] = field.value;
        }
        return acc;
      },
      {} as Record<string, string>,
    );

    updateMutation.mutate({
      id: contact.id,
      customName: customName.trim() || null,
      notes: notes.trim() || null,
      customFields: customFieldsObject,
    });
  };

  return (
    <Sheet
      key={`${contact.id}-${open}`}
      open={open}
      onOpenChange={onOpenChange}
    >
      <SheetContent className="flex w-full flex-col p-0 sm:max-w-md [&>button]:hidden">
        <SheetHeader className="flex-row items-center justify-between space-y-0 border-b px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="h-9 w-9"
          >
            <Check className="h-5 w-5" />
          </Button>
          <SheetTitle className="sr-only">Detalhes do Contato</SheetTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            disabled={updateMutation.isPending}
            className="h-9 w-9"
          >
            <X className="h-5 w-5" />
          </Button>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          <ContactDetailsAvatar contact={contact} source={source} />

          <div className="space-y-6 px-4 py-6">
            <ContactDetailsField
              label="Nome Personalizado"
              value={customName}
              onChange={setCustomName}
              placeholder="Digite um nome personalizado"
            />

            <ContactDetailsField
              label="Observações"
              value={notes}
              onChange={setNotes}
              placeholder="Digite observações sobre o contato"
              multiline
            />

            <div className="space-y-4">
              {customFields.map((field, index) => (
                <ContactDetailsCustomField
                  key={field.id}
                  label={field.label}
                  value={field.value}
                  onLabelChange={(label) => {
                    const newFields = [...customFields];
                    const field = newFields[index];
                    if (field) {
                      field.label = label;
                      setCustomFields(newFields);
                    }
                  }}
                  onValueChange={(value) => {
                    const newFields = [...customFields];
                    const field = newFields[index];
                    if (field) {
                      field.value = value;
                      setCustomFields(newFields);
                    }
                  }}
                />
              ))}
            </div>

            <Button
              variant="ghost"
              onClick={handleAddField}
              className="text-muted-foreground w-full justify-start"
            >
              <Plus className="mr-2 h-4 w-4" />
              adicionar campo
            </Button>

            {/* Lista de participantes para grupos */}
            {contact.isGroup && (
              <GroupParticipantsList contactId={contact.id} />
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ContactDetailsAvatar({
  contact,
  source = "whatsapp",
}: {
  contact: {
    name: string;
    phoneNumber: string | null;
    avatar: string | null;
    instanceCode?: string;
    isGroup?: boolean;
    groupJid?: string | null;
  };
  source?: "whatsapp" | "internal";
}) {
  const { formatPhone } = usePhoneDisplay();

  return (
    <div className="flex flex-col items-center py-8">
      <Avatar className="mb-4 h-40 w-40 border">
        {contact.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={contact.avatar}
            alt={contact.name}
            className="object-cover"
          />
        ) : (
          <AvatarFallback className="bg-muted text-muted-foreground">
            {contact.isGroup ? (
              <FaUsers className="h-16 w-16" />
            ) : (
              <FaUser className="h-16 w-16" />
            )}
          </AvatarFallback>
        )}
      </Avatar>

      <h2 className="mb-1 text-xl font-semibold">{contact.name}</h2>
      {source === "internal" ? (
        <p className="text-muted-foreground text-sm">
          {contact.instanceCode ?? "Sem código"}
        </p>
      ) : contact.isGroup ? (
        <div className="flex items-center gap-1.5">
          <p className="text-muted-foreground text-sm">
            {contact.groupJid ?? "Grupo"}
          </p>
          <FaUsers className="text-muted-foreground h-4 w-4" />
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <p className="text-muted-foreground text-sm">
            {formatPhone(contact.phoneNumber)}
          </p>
          <FaWhatsapp className="text-muted-foreground h-4 w-4" />
        </div>
      )}
    </div>
  );
}

function ContactDetailsField({
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-muted-foreground text-sm">{label}</Label>
      {multiline ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="min-h-20 resize-none"
        />
      ) : (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}

function ContactDetailsCustomField({
  label,
  value,
  onLabelChange,
  onValueChange,
}: {
  label: string;
  value: string;
  onLabelChange: (label: string) => void;
  onValueChange: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 items-center gap-4">
      <Input
        value={label}
        onChange={(e) => onLabelChange(e.target.value)}
        className="text-sm"
      />
      <Input
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        className="col-span-2"
      />
    </div>
  );
}

/**
 * Lista de participantes do grupo WhatsApp
 */
function GroupParticipantsList({ contactId }: { contactId: string }) {
  const trpc = useTRPC();
  const router = useRouter();
  const { formatPhone } = usePhoneDisplay();

  const { data, isLoading, error } = useQuery(
    trpc.contacts.getGroupParticipants.queryOptions({ contactId }),
  );

  const startConversationMutation = useMutation(
    trpc.chats.createWhatsAppChat.mutationOptions({
      onSuccess: (newChat) => {
        router.push(`/chats/${newChat.id}`);
      },
      onError: (error) => {
        toast.error(error.message || "Erro ao iniciar conversa");
      },
    }),
  );

  const handleStartConversation = (phoneNumber: string) => {
    // Remove qualquer sufixo do id (ex: @s.whatsapp.net)
    const cleanPhone = phoneNumber.replace(/@.*$/, "");
    startConversationMutation.mutate({ phoneNumber: cleanPhone });
  };

  if (isLoading) {
    return (
      <div className="space-y-3 pt-4">
        <div className="flex items-center gap-2">
          <FaUsers className="text-muted-foreground h-4 w-4" />
          <span className="text-muted-foreground text-sm font-medium">
            Participantes
          </span>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 py-2">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !data?.participants.length) {
    return (
      <div className="space-y-3 pt-4">
        <div className="flex items-center gap-2">
          <FaUsers className="text-muted-foreground h-4 w-4" />
          <span className="text-muted-foreground text-sm font-medium">
            Participantes
          </span>
        </div>
        <p className="text-muted-foreground text-sm">
          {error ? "Erro ao carregar participantes" : "Nenhum participante encontrado"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-4">
      <div className="flex items-center gap-2">
        <FaUsers className="text-muted-foreground h-4 w-4" />
        <span className="text-muted-foreground text-sm font-medium">
          {data.total} participantes
        </span>
      </div>

      <div className="divide-y">
        {data.participants.map((participant) => (
          <div
            key={participant.id}
            className="flex items-center gap-3 py-3"
          >
            {/* Avatar */}
            <Avatar className="h-10 w-10">
              {participant.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={participant.avatar}
                  alt={participant.name ?? undefined}
                  className="object-cover"
                />
              ) : (
                <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                  <FaUser className="h-4 w-4" />
                </AvatarFallback>
              )}
            </Avatar>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-medium">
                  {participant.name ?? formatPhone(participant.phoneNumber)}
                </span>
                {participant.isSuperAdmin && (
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
                {participant.isAdmin && !participant.isSuperAdmin && (
                  <Shield className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
              </div>
              <span className="text-muted-foreground text-xs">
                {participant.isSuperAdmin
                  ? "Criador do grupo"
                  : participant.isAdmin
                    ? "Admin"
                    : "Membro"}
              </span>
            </div>

            {/* Botão iniciar conversa - não mostra para o próprio usuário */}
            {!participant.isMe && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => handleStartConversation(participant.phoneNumber)}
                disabled={startConversationMutation.isPending}
              >
                <MessageCircle className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
