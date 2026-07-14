import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

export function TypingIndicator({ channelId }: { channelId: Id<"channels"> }) {
  const typers = useQuery(api.typing.list, { channelId }) ?? [];

  const text =
    typers.length === 0
      ? ""
      : typers.length === 1
        ? `${typers[0].name} is typing…`
        : typers.length === 2
          ? `${typers[0].name} and ${typers[1].name} are typing…`
          : "Several people are typing…";

  return (
    <div className="h-5 px-4 text-xs text-discord-muted" aria-live="polite">
      {text}
    </div>
  );
}
