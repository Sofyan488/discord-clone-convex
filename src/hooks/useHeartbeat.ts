import { useEffect, useRef } from "react";

// Visibility-aware interval. Fires `onBeat` immediately, then every
// `intervalMs` while the tab is visible; pauses when hidden and beats once on
// becoming visible again. Drives presence (T024) and in-call heartbeats (T066).
export function useHeartbeat(
  onBeat: () => void,
  intervalMs = 10_000,
  enabled = true,
) {
  const cb = useRef(onBeat);
  cb.current = onBeat;

  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setInterval> | undefined;

    const beat = () => {
      if (document.visibilityState === "visible") cb.current();
    };

    const start = () => {
      beat();
      timer = setInterval(beat, intervalMs);
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") beat();
    };

    start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs, enabled]);
}
