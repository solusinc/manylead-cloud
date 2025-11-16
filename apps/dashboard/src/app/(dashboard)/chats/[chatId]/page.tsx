"use client";

import { use } from "react";
import { ChatLayout } from "~/components/chat/chat-layout";
import { ChatWindow } from "~/components/chat/window";

export default function ChatPage({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const { chatId } = use(params);

  return (
    <ChatLayout hasChatSelected>
      <ChatWindow chatId={chatId} />
    </ChatLayout>
  );
}
