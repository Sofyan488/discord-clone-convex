import { usePaginatedQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { MessageScroller } from "./MessageScroller";
import { useCurrentUser } from "@/hooks/useCurrentUser";

// Channel message history (FR-018, FR-023).
export function MessageList({ channelId }: { channelId: Id<"channels"> }) {
  const me = useCurrentUser();
  const { results, status, loadMore } = usePaginatedQuery(
    api.messages.list,
    { channelId },
    { initialNumItems: 50 },
  );
  const edit = useMutation(api.messages.edit);
  const remove = useMutation(api.messages.remove);

  return (
    <MessageScroller
      results={results}
      status={status}
      onLoadMore={() => loadMore(50)}
      meId={me?._id}
      emptyText="No messages yet — say hello!"
      onEdit={async (id, content) => {
        await edit({ messageId: id as Id<"messages">, content });
      }}
      onDelete={async (id) => {
        await remove({ messageId: id as Id<"messages"> });
      }}
    />
  );
}
