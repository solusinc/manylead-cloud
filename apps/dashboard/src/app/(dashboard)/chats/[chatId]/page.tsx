import { HydrateClient, getQueryClient, trpc } from "~/lib/trpc/server";
import { ChatLayout } from "~/components/chat/chat-layout";
import { ChatWindow } from "~/components/chat/window";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const { chatId } = await params;
  const queryClient = getQueryClient();

  // Prefetch apenas mensagens (chats já em cache)
  await queryClient.prefetchInfiniteQuery(
    trpc.messages.list.infiniteQueryOptions({
      chatId,
      firstPageLimit: 50,
      limit: 30,
    })
  );

  return (
    <HydrateClient>
      <ChatLayout hasChatSelected>
        <ChatWindow chatId={chatId} />
      </ChatLayout>
    </HydrateClient>
  );
}
