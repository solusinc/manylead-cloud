import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/lib/trpc/react";
import { useServerSession } from "~/components/providers/session-provider";

/**
 * Singleton hook for current agent data
 *
 * Centralizes the agent query that was duplicated across 5+ files.
 * Prevents duplicate queries and provides memoized result.
 *
 * @example
 * ```tsx
 * const { data: currentAgent, isLoading } = useCurrentAgent();
 *
 * if (currentAgent) {
 *   console.log("Current agent:", currentAgent.name);
 * }
 * ```
 */
export function useCurrentAgent() {
  const trpc = useTRPC();
  const session = useServerSession();

  return useQuery(
    trpc.agents.getByUserId.queryOptions({
      userId: session.user.id,
    }),
  );
}
