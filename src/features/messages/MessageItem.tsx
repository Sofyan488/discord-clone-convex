import { useState } from "react";
import type { Id } from "@convex/_generated/dataModel";
import { Avatar } from "@/components/Avatar";

// A message id can be a channel message or a direct message — the presentational
// row handles both.
export type MessageId = Id<"messages"> | Id<"directMessages">;

export type ChannelMessage = {
  _id: MessageId;
  authorId: Id<"users">;
  authorName: string;
  authorAvatarUrl?: string;
  content: string;
  _creationTime: number;
  editedAt?: number;
};

type Props = {
  message: ChannelMessage;
  isOwn: boolean;
  onEdit: (id: MessageId, content: string) => Promise<void>;
  onDelete: (id: MessageId) => Promise<void>;
};

function formatTime(ms: number) {
  return new Date(ms).toLocaleString([], {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function MessageItem({ message, isOwn, onEdit, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);

  async function saveEdit() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== message.content) {
      await onEdit(message._id, trimmed);
    }
    setEditing(false);
  }

  return (
    <div className="group flex gap-3 px-4 py-1.5 hover:bg-black/10">
      <Avatar name={message.authorName} src={message.authorAvatarUrl} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-white">
            {message.authorName}
          </span>
          <span className="text-xs text-discord-muted">
            {formatTime(message._creationTime)}
          </span>
          {message.editedAt && (
            <span className="text-xs text-discord-muted">(edited)</span>
          )}
        </div>

        {editing ? (
          <div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void saveEdit();
                }
                if (e.key === "Escape") setEditing(false);
              }}
              className="mt-1 w-full rounded bg-black/30 p-2 text-sm outline-none"
              autoFocus
              rows={2}
            />
            <div className="mt-1 text-xs text-discord-muted">
              escape to{" "}
              <button
                className="text-discord-accent hover:underline"
                onClick={() => setEditing(false)}
              >
                cancel
              </button>{" "}
              • enter to{" "}
              <button
                className="text-discord-accent hover:underline"
                onClick={() => void saveEdit()}
              >
                save
              </button>
            </div>
          </div>
        ) : (
          <p className="whitespace-pre-wrap break-words text-discord-text">
            {message.content}
          </p>
        )}
      </div>

      {isOwn && !editing && (
        <div className="hidden shrink-0 gap-2 text-xs text-discord-muted group-hover:flex">
          <button
            onClick={() => {
              setDraft(message.content);
              setEditing(true);
            }}
            className="hover:text-discord-text"
            aria-label="Edit message"
          >
            Edit
          </button>
          <button
            onClick={() => {
              if (window.confirm("Delete this message?"))
                void onDelete(message._id);
            }}
            className="hover:text-discord-danger"
            aria-label="Delete message"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
