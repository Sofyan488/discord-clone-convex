import type { Id } from "@convex/_generated/dataModel";
import { Spinner } from "@/components/Spinner";
import { MessageItem, ChannelMessage } from "./MessageItem";

type Status =
  | "LoadingFirstPage"
  | "CanLoadMore"
  | "LoadingMore"
  | "Exhausted";

type Props = {
  results: ChannelMessage[];
  status: Status;
  onLoadMore: () => void;
  meId?: Id<"users">;
  emptyText: string;
  onEdit: (id: Id<"messages"> | Id<"directMessages">, content: string) => Promise<void>;
  onDelete: (id: Id<"messages"> | Id<"directMessages">) => Promise<void>;
};

// Shared message list rendering for both channels and DMs. Data (pagination) is
// owned by the caller; this component only renders. Column-reverse keeps the
// newest message pinned to the bottom; older pages load above.
export function MessageScroller({
  results,
  status,
  onLoadMore,
  meId,
  emptyText,
  onEdit,
  onDelete,
}: Props) {
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
        {emptyText}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col-reverse overflow-y-auto">
      {results.map((m) => (
        <MessageItem
          key={m._id}
          message={m}
          isOwn={m.authorId === meId}
          onEdit={(id, content) => onEdit(id, content)}
          onDelete={(id) => onDelete(id)}
        />
      ))}
      {status === "CanLoadMore" && (
        <div className="py-2 text-center">
          <button
            onClick={onLoadMore}
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
