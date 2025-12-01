"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useState } from "react";

interface ReplyMessage {
  id: string;
  content: string;
  senderName: string;
  timestamp: Date;
  messageType?: "text" | "image" | "video" | "audio" | "document";
}

interface ChatReplyContextValue {
  replyingTo: ReplyMessage | null;
  setReplyingTo: (message: ReplyMessage | null) => void;
  cancelReply: () => void;
  contactName: string;
  messageSource: "whatsapp" | "internal";
  mediaPreview: File | null;
  setMediaPreview: (file: File | null) => void;
  cancelMediaPreview: () => void;
  focusInput: (() => void) | null;
  setFocusInput: (fn: (() => void) | null) => void;
}

const ChatReplyContext = createContext<ChatReplyContextValue | null>(null);

export function ChatReplyProvider({
  children,
  contactName = "Contato",
  messageSource = "whatsapp",
}: {
  children: ReactNode;
  contactName?: string;
  messageSource?: "whatsapp" | "internal";
}) {
  const [replyingTo, setReplyingTo] = useState<ReplyMessage | null>(null);
  const [mediaPreview, setMediaPreview] = useState<File | null>(null);
  const [focusInput, setFocusInput] = useState<(() => void) | null>(null);

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
        mediaPreview,
        setMediaPreview,
        cancelMediaPreview,
        focusInput,
        setFocusInput,
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
