import { usePaginatedQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Spinner } from "@/components/Spinner";
import { MessageItem } from "./MessageItem";
import { useCurrentUser } from "@/hooks/useCurrentUser";

// Reactive, paginated channel history (FR-018, FR-023). Uses a
// column-reverse layout so the newest message sits at the bottom and older
// pages load above via "Load older".
export function MessageList({ channelId }: { channelId: Id<"channels"> }) {
  const me = useCurrentUser();
  const { results, status, loadMore } = usePaginatedQuery(
    api.messages.list,
    { channelId },
    { initialNumItems: 50 },
  );
  const edit = useMutation(api.messages.edit);
  const remove = useMutation(api.messages.remove);

  if (status === "LoadingFirstPage") {
    return (
      <div className="grid flex-1 place-items-center">
        <Spinner />
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="grid flex-1 place-items-center text-discord-muted">
        No messages yet — say hello!
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col-reverse overflow-y-auto">
      {/* results are newest-first; column-reverse renders newest at the bottom */}
      {results.map((m) => (
        <MessageItem
          key={m._id}
          message={m}
          isOwn={m.authorId === me?._id}
          onEdit={async (id, content) => {
            await edit({ messageId: id, content });
          }}
          onDelete={async (id) => {
            await remove({ messageId: id });
          }}
        />
      ))}
      {status === "CanLoadMore" && (
        <div className="py-2 text-center">
          <button
            onClick={() => loadMore(50)}
            className="text-sm text-discord-accent hover:underline"
          >
            Load older messages
          </button>
        </div>
      )}
      {status === "LoadingMore" && (
        <div className="py-2 text-center">
          <Spinner label="Loading older messages" />
        </div>
      )}
    </div>
  );
}
