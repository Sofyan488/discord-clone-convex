import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { useHeartbeat } from "./useHeartbeat";

// Sends a presence heartbeat every ~10s while the tab is visible (US1: T024).
// Per-user, multi-session safe: no explicit offline signal (research R3).
export function usePresence(enabled: boolean) {
  const heartbeat = useMutation(api.presence.heartbeat);
  useHeartbeat(
    () => {
      void heartbeat({});
    },
    10_000,
    enabled,
  );
}
