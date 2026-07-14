import { KeyboardEvent, useState } from "react";
import { useTyping, TypingTarget } from "@/hooks/useTyping";

type Props = {
  placeholder: string;
  typingTarget: TypingTarget;
  // Sends the message; clientKey makes reconnect retries idempotent (SC-009).
  onSend: (content: string, clientKey: string) => Promise<void>;
};

// Shared composer for channels and DMs.
export function MessageComposer({ placeholder, typingTarget, onSend }: Props) {
  const { onType, stop } = useTyping(typingTarget);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const content = text.trim();
    if (!content) return;
    setText("");
    stop();
    setError(null);
    try {
      await onSend(content, crypto.randomUUID());
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
        placeholder={placeholder}
        aria-label={placeholder}
        className="max-h-40 w-full resize-none rounded-lg bg-[#383a40] px-4 py-3 text-sm text-discord-text outline-none"
      />
    </div>
  );
}
