import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@manylead/ui/dialog";
import { Button } from "@manylead/ui/button";
import { Input } from "@manylead/ui/input";
import { Label } from "@manylead/ui/label";
import { toast } from "sonner";

interface CustomVariablesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variables: string[]; // Array de nomes de variáveis que precisam ser preenchidas
  onSubmit: (values: Record<string, string>) => void;
}

export function CustomVariablesDialog({
  open,
  onOpenChange,
  variables,
  onSubmit,
}: CustomVariablesDialogProps) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    variables.reduce((acc, variable) => ({ ...acc, [variable]: "" }), {})
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validar que todos os campos foram preenchidos
    const allFilled = variables.every((variable) => values[variable]?.trim());

    if (!allFilled) {
      toast.error("Preencha todas as variáveis");
      return;
    }

    onSubmit(values);
    onOpenChange(false);

    // Resetar valores
    setValues(
      variables.reduce((acc, variable) => ({ ...acc, [variable]: "" }), {})
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Preencher Variáveis</DialogTitle>
          <DialogDescription>
            Esta mensagem contém variáveis que precisam ser preenchidas antes de enviar.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {variables.map((variable) => (
              <div key={variable} className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor={variable} className="text-right">
                  {variable}
                </Label>
                <Input
                  id={variable}
                  value={values[variable] ?? ""}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setValues((prev) => ({ ...prev, [variable]: e.target.value }))
                  }
                  className="col-span-3"
                  autoFocus={variable === variables[0]}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button type="submit">Enviar Mensagem</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
