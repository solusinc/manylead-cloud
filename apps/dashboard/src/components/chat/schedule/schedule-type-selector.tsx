import { ChevronRight, MessageSquare, StickyNote } from "lucide-react";
import { Card, CardContent } from "@manylead/ui/card";

interface ScheduleTypeSelectorProps {
  onSelect: (type: "message" | "comment") => void;
}

export function ScheduleTypeSelector({ onSelect }: ScheduleTypeSelectorProps) {
  return (
    <div className="grid gap-4 p-4">
      {/* Card 1: Agendar Mensagem */}
      <Card
        className="cursor-pointer transition-colors hover:border-primary"
        onClick={() => onSelect("message")}
      >
        <CardContent className="flex items-center gap-4 p-6">
          <div className="rounded-lg bg-primary/10 p-3">
            <MessageSquare className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold">Agendar mensagem</h3>
            <p className="text-sm text-muted-foreground">
              Enviar uma mensagem para o contato no horário agendado
            </p>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </CardContent>
      </Card>

      {/* Card 2: Agendar Nota */}
      <Card
        className="cursor-pointer transition-colors hover:border-primary"
        onClick={() => onSelect("comment")}
      >
        <CardContent className="flex items-center gap-4 p-6">
          <div className="rounded-lg bg-amber-500/10 p-3">
            <StickyNote className="h-6 w-6 text-amber-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold">Agendar uma nota</h3>
            <p className="text-sm text-muted-foreground">
              Criar uma nota interna visível apenas para a equipe
            </p>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </CardContent>
      </Card>
    </div>
  );
}
