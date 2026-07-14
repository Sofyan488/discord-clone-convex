import { usePaginatedQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { MessageScroller } from "@/features/messages/MessageScroller";
import { useCurrentUser } from "@/hooks/useCurrentUser";

// Direct-message history (FR-027). Reuses the shared MessageScroller.
export function DmMessageList({
  threadId,
}: {
  threadId: Id<"directMessageThreads">;
}) {
  const me = useCurrentUser();
  const { results, status, loadMore } = usePaginatedQuery(
    api.directMessages.list,
    { threadId },
    { initialNumItems: 50 },
  );
  const edit = useMutation(api.directMessages.edit);
  const remove = useMutation(api.directMessages.remove);

  return (
    <MessageScroller
      results={results}
      status={status}
      onLoadMore={() => loadMore(50)}
      meId={me?._id}
      emptyText="No messages yet — this is the start of your conversation."
      onEdit={async (id, content) => {
        await edit({ messageId: id as Id<"directMessages">, content });
      }}
      onDelete={async (id) => {
        await remove({ messageId: id as Id<"directMessages"> });
      }}
    />
  );
}
