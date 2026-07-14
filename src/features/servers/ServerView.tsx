import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { ChannelSidebar } from "@/features/channels/ChannelSidebar";
import { ChannelView } from "@/features/messages/ChannelView";
import { MemberList } from "./MemberList";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Spinner } from "@/components/Spinner";

// A selected server: channel sidebar + channel view + member list (US2 + US3).
export function ServerView() {
  const { serverId } = useParams();
  const id = serverId as Id<"servers">;
  const servers = useQuery(api.servers.listMine);
  const me = useCurrentUser();
  const server = servers?.find((s) => s._id === id);
  const channels = useQuery(
    api.channels.list,
    server ? { serverId: id } : "skip",
  );

  const [selectedId, setSelectedId] = useState<Id<"channels"> | null>(null);

  // Default to the first text channel; keep selection valid as channels change.
  useEffect(() => {
    if (!channels) return;
    const stillExists = channels.some((c) => c._id === selectedId);
    if (!stillExists) {
      const firstText = channels.find((c) => c.type === "text");
      setSelectedId(firstText?._id ?? channels[0]?._id ?? null);
    }
  }, [channels, selectedId]);

  if (servers === undefined) {
    return (
      <div className="grid flex-1 place-items-center bg-discord-bg">
        <Spinner />
      </div>
    );
  }

  if (!server) {
    return (
      <div className="grid flex-1 place-items-center bg-discord-bg text-discord-muted">
        You are not a member of this server.
      </div>
    );
  }

  const isOwner = server.ownerId === me?._id;
  const selected = channels?.find((c) => c._id === selectedId) ?? null;

  return (
    <div className="flex min-w-0 flex-1">
      <ChannelSidebar
        serverId={id}
        serverName={server.name}
        isOwner={isOwner}
        channels={channels ?? []}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />
      {selected ? (
        <ChannelView channel={selected} />
      ) : (
        <main className="grid min-w-0 flex-1 place-items-center bg-discord-bg text-discord-muted">
          {channels === undefined ? <Spinner /> : <p>No channels yet.</p>}
        </main>
      )}
      <MemberList serverId={id} />
    </div>
  );
}
