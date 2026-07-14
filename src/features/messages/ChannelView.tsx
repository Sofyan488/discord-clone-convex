import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Channel } from "@/features/channels/ChannelSidebar";
import { MessageList } from "./MessageList";
import { MessageComposer } from "./MessageComposer";
import { TypingIndicator } from "./TypingIndicator";

// Main area for a selected channel. Text channels show live messaging; voice
// channels are placeholders until calls arrive in User Story 5.
export function ChannelView({ channel }: { channel: Channel }) {
  const send = useMutation(api.messages.send);

  if (channel.type === "voice") {
    return (
      <main className="grid min-w-0 flex-1 place-items-center bg-discord-bg text-discord-muted">
        <p>🔊 {channel.name} — voice calls arrive in User Story 5.</p>
      </main>
    );
  }

  return (
    <main className="flex min-w-0 flex-1 flex-col bg-discord-bg">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-black/20 px-4 font-semibold shadow-sm">
        <span className="text-discord-muted">#</span>
        {channel.name}
      </div>
      <MessageList channelId={channel._id} />
      <TypingIndicator target={{ channelId: channel._id }} />
      <MessageComposer
        placeholder={`Message #${channel.name}`}
        typingTarget={{ channelId: channel._id }}
        onSend={(content, clientKey) =>
          send({ channelId: channel._id, content, clientKey }).then(() => {})
        }
      />
    </main>
  );
}
