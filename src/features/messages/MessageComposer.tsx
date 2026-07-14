import { KeyboardEvent, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useTyping } from "@/hooks/useTyping";

export function MessageComposer({
  channelId,
  channelName,
}: {
  channelId: Id<"channels">;
  channelName: string;
}) {
  const send = useMutation(api.messages.send);
  const { onType, stop } = useTyping(channelId);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const content = text.trim();
    if (!content) return;
    setText("");
    stop();
    setError(null);
    try {
      // Stable per-attempt key so a reconnect retry does not duplicate (SC-009).
      await send({ channelId, content, clientKey: crypto.randomUUID() });
    } catch (err) {
      console.error("Send failed:", err);
      setError("Message failed to send. Try again.");
      setText(content);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  }

  return (
    <div className="px-4 pb-4">
      {error && (
        <p role="alert" className="mb-1 text-xs text-discord-danger">
          {error}
        </p>
      )}
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onType();
        }}
        onKeyDown={onKeyDown}
        onBlur={stop}
        rows={1}
        placeholder={`Message #${channelName}`}
        aria-label={`Message #${channelName}`}
        className="max-h-40 w-full resize-none rounded-lg bg-[#383a40] px-4 py-3 text-sm text-discord-text outline-none"
      />
    </div>
  );
}
