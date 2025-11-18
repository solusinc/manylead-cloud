import { HydrateClient, getQueryClient, trpc } from "~/lib/trpc/server";
import { ChatLayout } from "~/components/chat/chat-layout";

export default async function ChatsPage() {
  const queryClient = getQueryClient();

  // Prefetch lista de chats para hidratar
  await queryClient.prefetchQuery(
    trpc.chats.list.queryOptions({
      limit: 100,
      offset: 0,
    })
  );

  return (
    <HydrateClient>
      <ChatLayout>
        {/* No chat selected - will show empty state */}
      </ChatLayout>
    </HydrateClient>
  );
}
