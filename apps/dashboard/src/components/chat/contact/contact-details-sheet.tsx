"use client";

import { useState } from "react";
import Image from "next/image";
import { Check, X, Plus } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";

import { cn } from "@manylead/ui";
import { Button } from "@manylead/ui/button";
import { Input } from "@manylead/ui/input";
import { Label } from "@manylead/ui/label";
import { Textarea } from "@manylead/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@manylead/ui/sheet";
import { Avatar, AvatarFallback } from "@manylead/ui/avatar";
import { formatBrazilianPhone } from "@manylead/shared/utils";

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
    Array<{ id: string; label: string; value: string }>
  >([]);

  const handleAddField = () => {
    const newFieldNumber = customFields.length + 1;
    setCustomFields([
      ...customFields,
      { id: String(newFieldNumber), label: `Campo-${newFieldNumber}`, value: "" },
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
      <SheetContent className="w-full sm:max-w-md p-0 flex flex-col [&>button]:hidden">
        <SheetHeader className="border-b px-4 py-3 flex-row items-center justify-between space-y-0">
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

          <div className="px-4 py-6 space-y-6">
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
                    newFields[index].value = value;
                    setCustomFields(newFields);
                  }}
                />
              ))}
            </div>

            <Button
              variant="ghost"
              onClick={handleAddField}
              className="w-full justify-start text-muted-foreground"
            >
              <Plus className="h-4 w-4 mr-2" />
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
    <div className="flex flex-col items-center py-8 bg-muted/20">
      <Avatar className="h-40 w-40 mb-4">
        {contact.avatar ? (
          <img src={contact.avatar} alt={contact.name} className="object-cover" />
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

      <h2 className="text-xl font-semibold mb-1">{contact.name}</h2>
      <div className="flex items-center gap-1.5">
        <p className="text-sm text-muted-foreground">
          {formatBrazilianPhone(contact.phoneNumber)}
        </p>
        <FaWhatsapp className="h-4 w-4 text-muted-foreground" />
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
      <Label className="text-sm text-muted-foreground">{label}</Label>
      {multiline ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="min-h-[80px] resize-none"
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
    <div className="grid grid-cols-3 gap-4 items-center">
      <Label className="text-sm">{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="col-span-2"
      />
    </div>
  );
}
