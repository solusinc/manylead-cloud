"use client";

import { useState } from "react";
import { Button } from "@manylead/ui/button";
import { Label } from "@manylead/ui/label";
import { RadioGroup, RadioGroupItem } from "@manylead/ui/radio-group";
import { useChatFiltersStore } from "~/stores/use-chat-filters-store";

type StatusFilter = "all" | "in_progress" | "finished" | "waiting";

export function ChatFiltersSheet() {
  const { isOpen, close } = useChatFiltersStore();
  const [status, setStatus] = useState<StatusFilter>("all");

  const handleApply = () => {
    // TODO: Aplicar filtros
    console.log("Aplicando filtros:", { status });
    close();
  };

  const handleClearFilters = () => {
    setStatus("all");
    // TODO: Limpar outros filtros quando implementados
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm z-40"
        onClick={close}
      />

      {/* Sheet */}
      <div className="absolute inset-0 z-50 bg-background flex flex-col">
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-24">
          {/* Situação */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Situação</Label>
            <RadioGroup value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="status-all" />
                <Label htmlFor="status-all" className="font-normal cursor-pointer">
                  Todas
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="in_progress" id="status-in-progress" />
                <Label htmlFor="status-in-progress" className="font-normal cursor-pointer">
                  Em atendimento
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="finished" id="status-finished" />
                <Label htmlFor="status-finished" className="font-normal cursor-pointer">
                  Finalizadas
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="waiting" id="status-waiting" />
                <Label htmlFor="status-waiting" className="font-normal cursor-pointer">
                  Aguardando atendimento
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* TODO: Adicionar outros filtros */}
          {/* Período */}
          {/* Usuários */}
          {/* Finalizações */}
          {/* Departamentos */}
          {/* Etiquetas */}
          {/* Provedores */}
        </div>

        {/* Footer com botões */}
        <div className="border-t bg-background h-14 flex items-center px-4">
          <div className="flex gap-3 w-full">
            <Button onClick={handleApply} className="flex-1">
              Aplicar
            </Button>
            <Button onClick={handleClearFilters} variant="ghost">
              Remover filtros
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
