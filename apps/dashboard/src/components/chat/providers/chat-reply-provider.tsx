"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useState } from "react";

interface ReplyMessage {
  id: string;
  content: string;
  senderName: string;
  timestamp: Date;
}

interface ChatReplyContextValue {
  replyingTo: ReplyMessage | null;
  setReplyingTo: (message: ReplyMessage | null) => void;
  cancelReply: () => void;
  contactName: string;
  messageSource: "whatsapp" | "internal";
  instanceCode?: string;
  organizationName?: string;
  mediaPreview: File | null;
  setMediaPreview: (file: File | null) => void;
  cancelMediaPreview: () => void;
}

const ChatReplyContext = createContext<ChatReplyContextValue | null>(null);

export function ChatReplyProvider({
  children,
  contactName = "Contato",
  messageSource = "whatsapp",
  instanceCode,
  organizationName,
}: {
  children: ReactNode;
  contactName?: string;
  messageSource?: "whatsapp" | "internal";
  instanceCode?: string;
  organizationName?: string;
}) {
  const [replyingTo, setReplyingTo] = useState<ReplyMessage | null>(null);
  const [mediaPreview, setMediaPreview] = useState<File | null>(null);

  const cancelReply = () => {
    setReplyingTo(null);
  };

  const cancelMediaPreview = () => {
    setMediaPreview(null);
  };

  return (
    <ChatReplyContext.Provider
      value={{
        replyingTo,
        setReplyingTo,
        cancelReply,
        contactName,
        messageSource,
        instanceCode,
        organizationName,
        mediaPreview,
        setMediaPreview,
        cancelMediaPreview,
      }}
    >
      {children}
    </ChatReplyContext.Provider>
  );
}

export function useChatReply() {
  const context = useContext(ChatReplyContext);
  if (!context) {
    throw new Error("useChatReply must be used within ChatReplyProvider");
  }
  return context;
}
