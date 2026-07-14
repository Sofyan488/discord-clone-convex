import { useCallback, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

// Throttled typing signal for a channel (FR-024). `onType` fires at most once
// every 2s; `stop` clears the indicator (call on send / blur).
export function useTyping(channelId: Id<"channels">) {
  const setTyping = useMutation(api.typing.setTyping);
  const clearTyping = useMutation(api.typing.clearTyping);
  const lastSent = useRef(0);

  const onType = useCallback(() => {
    const now = Date.now();
    if (now - lastSent.current > 2000) {
      lastSent.current = now;
      void setTyping({ channelId });
    }
  }, [channelId, setTyping]);

  const stop = useCallback(() => {
    lastSent.current = 0;
    void clearTyping({ channelId });
  }, [channelId, clearTyping]);

  return { onType, stop };
}
