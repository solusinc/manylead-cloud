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

  // Prefetch lista de chats (para a sidebar)
  await queryClient.prefetchQuery(
    trpc.chats.list.queryOptions({
      limit: 100,
      offset: 0,
    })
  );

  // Prefetch mensagens do chat específico (TEMPORÁRIO: 10 mensagens iniciais, 2 por scroll)
  await queryClient.prefetchInfiniteQuery(
    trpc.messages.list.infiniteQueryOptions({
      chatId,
      firstPageLimit: 10,
      limit: 2,
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
