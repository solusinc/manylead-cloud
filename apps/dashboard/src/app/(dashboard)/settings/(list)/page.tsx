import { HydrateClient, getQueryClient, trpc } from "~/lib/trpc/server";
import { Client } from "./client";

export default async function Page() {
  const queryClient = getQueryClient();

  // Prefetch: carrega dados do canal para o modal de conexão abrir instantaneamente
  await queryClient.prefetchQuery(trpc.channels.getByType.queryOptions({ channelType: "qr_code" }));

  return (
    <HydrateClient>
      <Client />
    </HydrateClient>
  );
}
