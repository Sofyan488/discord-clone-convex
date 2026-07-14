import { useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

export type TypingTarget =
  | { channelId: Id<"channels"> }
  | { threadId: Id<"directMessageThreads"> };

// Throttled typing signal for a channel or DM thread (FR-024). `onType` fires
// at most once every 2s; `stop` clears the indicator (call on send / blur).
export function useTyping(target: TypingTarget) {
  const setTyping = useMutation(api.typing.setTyping);
  const clearTyping = useMutation(api.typing.clearTyping);
  const lastSent = useRef(0);

  const onType = () => {
    const now = Date.now();
    if (now - lastSent.current > 2000) {
      lastSent.current = now;
      void setTyping(target);
    }
  };

  const stop = () => {
    lastSent.current = 0;
    void clearTyping(target);
  };

  return { onType, stop };
}
