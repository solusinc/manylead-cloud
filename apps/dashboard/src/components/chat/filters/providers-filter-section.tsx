"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronDown, ChevronUp } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";

import { Checkbox } from "@manylead/ui/checkbox";

import type { MessageSourceFilter } from "~/stores/use-chat-filters-store";

interface ProvidersFilterSectionProps {
  selectedSources: MessageSourceFilter[];
  onToggleSource: (source: MessageSourceFilter) => void;
}

const providers: { id: MessageSourceFilter; label: string; icon: React.ReactNode }[] = [
  {
    id: "internal",
    label: "Manylead",
    icon: (
      <>
        <Image
          src="/assets/manylead-icon-light.png"
          alt="ManyLead"
          width={20}
          height={20}
          className="dark:hidden"
        />
        <Image
          src="/assets/manylead-icon-dark.png"
          alt="ManyLead"
          width={20}
          height={20}
          className="hidden dark:block"
        />
      </>
    ),
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    icon: <FaWhatsapp className="text-foreground h-5 w-5" />,
  },
];

export function ProvidersFilterSection({
  selectedSources,
  onToggleSource,
}: ProvidersFilterSectionProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between py-4 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold">Provedores</span>
          {selectedSources.length > 0 && (
            <span className="text-xs bg-primary text-primary-foreground min-w-5 h-5 flex items-center justify-center rounded-full">
              {selectedSources.length}
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronUp className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        )}
      </button>

      {isOpen && (
        <div className="pb-4 space-y-2">
          {providers.map((provider) => (
            <label
              key={provider.id}
              className="flex items-center gap-3 cursor-pointer hover:bg-accent/50 rounded px-2 py-1.5 -mx-2"
            >
              <Checkbox
                checked={selectedSources.includes(provider.id)}
                onCheckedChange={() => onToggleSource(provider.id)}
              />
              <div className="flex items-center gap-2">
                <div className="shrink-0 w-5 h-5 flex items-center justify-center">
                  {provider.icon}
                </div>
                <span className="text-sm">{provider.label}</span>
              </div>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
