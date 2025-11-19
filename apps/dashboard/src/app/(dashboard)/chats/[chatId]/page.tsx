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

  // Prefetch lista de chats (para a sidebar), agents e departments (para transfer dialog)
  await Promise.all([
    queryClient.prefetchQuery(
      trpc.chats.list.queryOptions({
        limit: 100,
        offset: 0,
      })
    ),
    queryClient.prefetchQuery(
      trpc.agents.list.queryOptions()
    ),
    queryClient.prefetchQuery(
      trpc.departments.list.queryOptions()
    ),
    // Prefetch mensagens do chat específico (50 mensagens iniciais, 30 por scroll)
    queryClient.prefetchInfiniteQuery(
      trpc.messages.list.infiniteQueryOptions({
        chatId,
        firstPageLimit: 50,
        limit: 30,
      })
    ),
  ]);

  return (
    <HydrateClient>
      <ChatLayout hasChatSelected>
        <ChatWindow chatId={chatId} />
      </ChatLayout>
    </HydrateClient>
  );
}
