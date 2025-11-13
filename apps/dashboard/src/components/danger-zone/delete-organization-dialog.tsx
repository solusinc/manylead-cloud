"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@manylead/ui/alert-dialog";
import { Button } from "@manylead/ui/button";
import { Checkbox } from "@manylead/ui/checkbox";
import { Input } from "@manylead/ui/input";
import { Label } from "@manylead/ui/label";

interface DeleteOrganizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationName: string;
  onConfirm: () => void | Promise<void>;
  isPending?: boolean;
}

export function DeleteOrganizationDialog({
  open,
  onOpenChange,
  organizationName,
  onConfirm,
  isPending = false,
}: DeleteOrganizationDialogProps) {
  const [understood, setUnderstood] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const isValid = understood && confirmText === organizationName;

  function handleConfirm() {
    if (!isValid) return;

    void Promise.resolve(onConfirm()).then(() => {
      // Reset state after success
      setUnderstood(false);
      setConfirmText("");
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <div className="bg-destructive/10 flex size-10 items-center justify-center rounded-full">
              <AlertTriangle className="text-destructive size-5" />
            </div>
            <AlertDialogTitle>Deletar Organização</AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="space-y-4 pt-4">
              <div className="text-foreground font-medium">
                Esta ação é permanente e não pode ser desfeita.
              </div>

              <div className="bg-destructive/5 border-destructive/20 space-y-2 rounded-lg border p-4">
                <div className="font-medium">Todos os dados da organização serão deletados incluindo:</div>
                <ul className="text-muted-foreground space-y-1 text-sm">
                  <li>• Membros e permissões</li>
                  <li>• Agentes e departamentos</li>
                  <li>• Chats e históricos</li>
                  <li>• Configurações e integrações</li>
                </ul>
              </div>

              <div className="space-y-4">
                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="understand"
                    checked={understood}
                    onCheckedChange={(checked) =>
                      setUnderstood(checked === true)
                    }
                    disabled={isPending}
                  />
                  <Label
                    htmlFor="understand"
                    className="text-sm leading-tight font-normal"
                  >
                    Eu entendo que esta ação é irreversível e que todos os dados
                    serão permanentemente deletados
                  </Label>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-name">
                    Digite o nome da organização para confirmar:
                  </Label>
                  <Input
                    id="confirm-name"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    disabled={isPending || !understood}
                  />
                </div>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!isValid || isPending}
          >
            {isPending ? "Deletando..." : "Deletar Organização"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
