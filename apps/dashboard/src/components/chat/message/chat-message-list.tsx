"use client";

import { useQuery } from "@tanstack/react-query";
import { cn } from "@manylead/ui";
import { useRef, useEffect, useLayoutEffect, useState } from "react";
import { ChatMessage } from "./chat-message";
import { ChatMessageDateDivider } from "./chat-message-date";
import { useTRPC } from "~/lib/trpc/react";
import { useChatSocketContext } from "~/components/providers/chat-socket-provider";

export function ChatMessageList({
  chatId,
  className,
  ...props
}: {
  chatId: string;
} & React.ComponentProps<"div">) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const trpc = useTRPC();
  const socket = useChatSocketContext();
  const [isTyping, setIsTyping] = useState(false);

  // Buscar mensagens da API
  const { data: messagesData, isLoading } = useQuery(
    trpc.messages.list.queryOptions({
      chatId,
      limit: 100,
      offset: 0,
    })
  );

  const messages = messagesData?.items.map((item) => ({
    id: item.message.id,
    content: item.message.content,
    sender: item.isOwnMessage ? ("agent" as const) : ("contact" as const),
    timestamp: item.message.timestamp,
    status: item.message.status as "pending" | "sent" | "delivered" | "read" | undefined,
  })) ?? [];

  // Função para fazer scroll para o final
  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: "end" });
  };

  // useLayoutEffect para scroll ANTES do paint (evita flash visual)
  // Usado quando carrega o chat ou troca de chat
  useLayoutEffect(() => {
    if (!isLoading && messages.length > 0) {
      // Scroll instantâneo ao carregar
      scrollToBottom("instant");
    }
  }, [chatId, isLoading, messages.length]);

  // useEffect para scroll DEPOIS do paint (com animação)
  // Usado quando novas mensagens chegam
  useEffect(() => {
    if (messages.length > 0) {
      // Scroll suave quando mensagens mudam
      scrollToBottom("smooth");
    }
  }, [messages.length]);

  // Escutar eventos de typing para este chat
  useEffect(() => {
    if (!socket.isConnected) return;

    const unsubscribeTypingStart = socket.onTypingStart((data) => {
      if (data.chatId === chatId) {
        setIsTyping(true);
      }
    });

    const unsubscribeTypingStop = socket.onTypingStop((data) => {
      if (data.chatId === chatId) {
        setIsTyping(false);
      }
    });

    return () => {
      unsubscribeTypingStart();
      unsubscribeTypingStop();
    };
  }, [socket.isConnected, chatId, socket]);

  // Scroll quando typing indicator aparecer/desaparecer
  useEffect(() => {
    if (isTyping) {
      // Scroll suave quando alguém começa a digitar
      scrollToBottom("smooth");
    }
  }, [isTyping]);

  // Removido loading state - dados são prefetched no servidor

  return (
    <div
      ref={scrollRef}
      className={cn("space-y-4", className)}
      {...props}
    >
      <ChatMessageDateDivider date={new Date()} />

      <div className="space-y-2">
        {messages.map((message, index) => {
          const prevMessage = messages[index - 1];
          const showAvatar = !prevMessage || prevMessage.sender !== message.sender;

          return (
            <ChatMessage
              key={message.id}
              message={message}
              showAvatar={showAvatar}
            />
          );
        })}

        {/* Typing indicator - estilo WhatsApp */}
        {isTyping && <ChatMessageTypingIndicator />}

        {/* Elemento âncora invisível no final - técnica usada por WhatsApp/Telegram */}
        <div ref={messagesEndRef} className="h-0" />
      </div>
    </div>
  );
}

/**
 * Typing indicator - WhatsApp style
 * Usa o mesmo estilo do ChatMessageBubble para incoming messages
 */
function ChatMessageTypingIndicator() {
  return (
    <div className="mb-2 flex gap-2 justify-start">
      <div className="bg-msg-incoming max-w-[65%] rounded-2xl rounded-bl-sm px-4 py-2">
        <div className="flex items-center gap-0.5">
          <span
            className="animate-bounce text-lg leading-none opacity-70"
            style={{ animationDelay: "0ms", animationDuration: "1.4s" }}
          >
            •
          </span>
          <span
            className="animate-bounce text-lg leading-none opacity-70"
            style={{ animationDelay: "200ms", animationDuration: "1.4s" }}
          >
            •
          </span>
          <span
            className="animate-bounce text-lg leading-none opacity-70"
            style={{ animationDelay: "400ms", animationDuration: "1.4s" }}
          >
            •
          </span>
        </div>
      </div>
    </div>
  );
}
