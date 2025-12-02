import { MessageSquare, StickyNote } from "lucide-react";
import {
  ActionCard,
  ActionCardDescription,
  ActionCardGroup,
  ActionCardHeader,
  ActionCardTitle,
} from "~/components/content/action-card";

interface ScheduleTypeSelectorProps {
  onSelect: (type: "message" | "comment") => void;
}

export function ScheduleTypeSelector({ onSelect }: ScheduleTypeSelectorProps) {
  return (
    <div className="p-4">
      <ActionCardGroup>
        {/* Card 1: Agendar Mensagem */}
        <ActionCard
          className="h-full w-full cursor-pointer transition-colors hover:bg-accent"
          onClick={() => onSelect("message")}
        >
          <ActionCardHeader>
            <div className="flex gap-3">
              <div className="flex items-center justify-center">
                <MessageSquare className="h-5 w-5 shrink-0 text-muted-foreground" />
              </div>
              <div className="flex flex-col gap-1">
                <ActionCardTitle>Agendar mensagem</ActionCardTitle>
                <ActionCardDescription>
                  Enviar uma mensagem para o contato no horário agendado
                </ActionCardDescription>
              </div>
            </div>
          </ActionCardHeader>
        </ActionCard>

        {/* Card 2: Agendar Nota */}
        <ActionCard
          className="h-full w-full cursor-pointer transition-colors hover:bg-accent"
          onClick={() => onSelect("comment")}
        >
          <ActionCardHeader>
            <div className="flex gap-3">
              <div className="flex items-center justify-center">
                <StickyNote className="h-5 w-5 shrink-0 text-muted-foreground" />
              </div>
              <div className="flex flex-col gap-1">
                <ActionCardTitle>Agendar uma nota</ActionCardTitle>
                <ActionCardDescription>
                  Criar uma nota interna visível apenas para a equipe
                </ActionCardDescription>
              </div>
            </div>
          </ActionCardHeader>
        </ActionCard>
      </ActionCardGroup>
    </div>
  );
}
