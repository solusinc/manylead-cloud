"use client";

import { useState } from "react";
import Image from "next/image";
import { Check, Plus, X } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";

import { formatBrazilianPhone } from "@manylead/shared/utils";
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
import { Textarea } from "@manylead/ui/textarea";

interface ContactDetailsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: {
    name: string;
    phoneNumber: string;
    avatar: string | null;
    customName?: string;
    notes?: string;
  };
}

export function ContactDetailsSheet({
  open,
  onOpenChange,
  contact,
}: ContactDetailsSheetProps) {
  const [customName, setCustomName] = useState(contact.customName ?? "");
  const [notes, setNotes] = useState(contact.notes ?? "");
  const [customFields, setCustomFields] = useState<
    { id: string; label: string; value: string }[]
  >([]);

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

  const handleSave = () => {
    // TODO: Implement save mutation
    console.log("Saving contact details:", {
      customName,
      notes,
      customFields,
    });
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col p-0 sm:max-w-md [&>button]:hidden">
        <SheetHeader className="flex-row items-center justify-between space-y-0 border-b px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSave}
            className="h-9 w-9"
          >
            <Check className="h-5 w-5" />
          </Button>
          <SheetTitle className="text-base">Salvar</SheetTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            className="h-9 w-9"
          >
            <X className="h-5 w-5" />
          </Button>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          <ContactDetailsAvatar contact={contact} />

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
                  onChange={(value) => {
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
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ContactDetailsAvatar({
  contact,
}: {
  contact: {
    name: string;
    phoneNumber: string;
    avatar: string | null;
  };
}) {
  return (
    <div className="bg-muted/20 flex flex-col items-center py-8">
      <Avatar className="mb-4 h-40 w-40">
        {contact.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={contact.avatar}
            alt={contact.name}
            className="object-cover"
          />
        ) : (
          <AvatarFallback className="bg-muted relative overflow-hidden">
            <Image
              src="/assets/no-photo.svg"
              alt="No photo"
              fill
              className="object-cover"
            />
          </AvatarFallback>
        )}
      </Avatar>

      <h2 className="mb-1 text-xl font-semibold">{contact.name}</h2>
      <div className="flex items-center gap-1.5">
        <p className="text-muted-foreground text-sm">
          {formatBrazilianPhone(contact.phoneNumber)}
        </p>
        <FaWhatsapp className="text-muted-foreground h-4 w-4" />
      </div>
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
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 items-center gap-4">
      <Label className="text-sm">{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="col-span-2"
      />
    </div>
  );
}
