import { useCallback, useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

export type TypingTarget =
  | { channelId: Id<"channels"> }
  | { threadId: Id<"directMessageThreads"> };

// How long after the last keystroke we auto-clear the indicator. Kept below the
// server TYPING_WINDOW_MS (5s) so the row is deleted before it would go stale —
// the delete is a write, which is what makes watchers' `list` query re-run and
// drop the indicator (Convex queries don't re-evaluate on elapsed time alone).
const IDLE_CLEAR_MS = 3000;
// Throttle for re-announcing typing while the user keeps typing.
const THROTTLE_MS = 2000;

// Typing signal for a channel or DM thread (FR-024). Exposes `onType` (call on
// each keystroke) and `stop` (call on send). The hook also clears the indicator
// on idle, on target change/unmount (switching channel/DM, navigating away),
// and best-effort on tab hide/close.
export function useTyping(target: TypingTarget) {
  const setTyping = useMutation(api.typing.setTyping);
  const clearTyping = useMutation(api.typing.clearTyping);
  const targetKey = "channelId" in target ? target.channelId : target.threadId;

  const lastSent = useRef(0);
  const active = useRef(false); // do we currently have a typing row on the server?
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearIdle = () => {
    if (idle.current) clearTimeout(idle.current);
    idle.current = null;
  };

  const stop = useCallback(() => {
    clearIdle();
    lastSent.current = 0;
    if (active.current) {
      active.current = false;
      void clearTyping(target).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey]);

  const onType = useCallback(() => {
    const now = Date.now();
    if (now - lastSent.current > THROTTLE_MS) {
      lastSent.current = now;
      active.current = true;
      void setTyping(target).catch(() => {});
    }
    // Reset the idle countdown on every keystroke; fire stop() once quiet.
    clearIdle();
    idle.current = setTimeout(() => stop(), IDLE_CLEAR_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey, stop]);

  // Clear when the target changes or the composer unmounts (switching
  // channel/DM, navigating away, signing out). The cleanup closes over the
  // target from the render this effect was created for, so switching clears the
  // OLD target's row, not the new one.
  useEffect(() => {
    return () => {
      clearIdle();
      if (active.current) {
        active.current = false;
        void clearTyping(target).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey]);

  // Best-effort clear when the tab is hidden or closed. pagehide covers unload
  // and bfcache; visibilitychange covers tab switches. A hard crash may skip
  // both — the server staleness window and the cron sweep are the backstop.
  useEffect(() => {
    const clear = () => {
      if (active.current) {
        active.current = false;
        void clearTyping(target).catch(() => {});
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") clear();
    };
    window.addEventListener("pagehide", clear);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", clear);
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey]);

  return { onType, stop };
}
