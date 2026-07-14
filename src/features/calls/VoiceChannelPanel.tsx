import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/Button";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { CallView } from "./CallView";

// Voice-channel main area: a lobby showing who's connected + a Join button,
// then the live CallView once joined (FR-029).
export function VoiceChannelPanel({
  channelId,
  name,
}: {
  channelId: Id<"channels">;
  name: string;
}) {
  const [joined, setJoined] = useState(false);
  const state = useQuery(api.calls.getState, { channelId });

  if (joined) {
    return (
      <main className="min-w-0 flex-1">
        <ErrorBoundary
          title="This call ran into a problem."
          onLeave={() => setJoined(false)}
          leaveLabel="Leave call"
        >
          <CallView
            target={{ channelId }}
            title={name}
            onLeave={() => setJoined(false)}
          />
        </ErrorBoundary>
      </main>
    );
  }

  const count = state?.participants.length ?? 0;

  return (
    <main className="grid min-w-0 flex-1 place-items-center bg-discord-bg p-8 text-center">
      <div>
        <h2 className="mb-1 text-2xl font-bold">🔊 {name}</h2>
        <p className="mb-5 text-discord-muted">
          {count === 0
            ? "No one is in this channel yet."
            : `${count} ${count === 1 ? "person" : "people"} connected` +
              (state
                ? `: ${state.participants.map((p) => p.name).join(", ")}`
                : "")}
        </p>
        <Button onClick={() => setJoined(true)}>Join Voice</Button>
      </div>
    </main>
  );
}
