"use client";

import { cn } from "@manylead/ui";
import { useRef, useEffect } from "react";
import { ChatMessage } from "./chat-message";
import { ChatMessageDateDivider } from "./chat-message-date";

// Mock messages - será substituído por hook com tRPC
const mockMessages = [
  {
    id: "1",
    content: "Olá! Gostaria de saber mais sobre o produto",
    sender: "contact" as const,
    timestamp: new Date("2025-01-16T10:00:00"),
  },
  {
    id: "2",
    content: "Olá! Claro, ficarei feliz em ajudar. Sobre qual produto você gostaria de saber?",
    sender: "agent" as const,
    timestamp: new Date("2025-01-16T10:01:00"),
    status: "read" as const,
  },
  {
    id: "3",
    content: "Sobre o plano PRO. Quais são as funcionalidades incluídas?",
    sender: "contact" as const,
    timestamp: new Date("2025-01-16T10:02:00"),
  },
  {
    id: "4",
    content: "O plano PRO inclui:\n\n• Mensagens ilimitadas\n• Até 5 usuários\n• Integrações com WhatsApp\n• Suporte prioritário\n• Dashboard completo\n\nGostaria de saber mais alguma coisa?",
    sender: "agent" as const,
    timestamp: new Date("2025-01-16T10:03:00"),
    status: "delivered" as const,
  },
  {
    id: "5",
    content: "Perfeito! Qual o valor mensal?",
    sender: "contact" as const,
    timestamp: new Date("2025-01-16T10:05:00"),
  },
  {
    id: "6",
    content: "O plano PRO custa R$ 297/mês. Temos um desconto especial de 20% para o primeiro ano se contratar agora! 🎉",
    sender: "agent" as const,
    timestamp: new Date("2025-01-16T10:06:00"),
    status: "sent" as const,
  },
];

export function ChatMessageList({
  chatId: _chatId,
  className,
  ...props
}: {
  chatId: string;
} & React.ComponentProps<"div">) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on mount
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  return (
    <div
      ref={scrollRef}
      className={cn("space-y-4", className)}
      {...props}
    >
      <ChatMessageDateDivider date={new Date()} />

      <div className="space-y-2">
        {mockMessages.map((message, index) => {
          const prevMessage = mockMessages[index - 1];
          const showAvatar = !prevMessage || prevMessage.sender !== message.sender;

          return (
            <ChatMessage
              key={message.id}
              message={message}
              showAvatar={showAvatar}
            />
          );
        })}
      </div>
    </div>
  );
}
