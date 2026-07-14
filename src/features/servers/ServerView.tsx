import { useParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { ServerHeader } from "./ServerHeader";
import { MemberList } from "./MemberList";
import { useCurrentUser } from "@/hooks/useCurrentUser";

// A selected server: channel sidebar + main area + member list.
// Channels and messaging in the main area arrive in User Story 3.
export function ServerView() {
  const { serverId } = useParams();
  const id = serverId as Id<"servers">;
  const servers = useQuery(api.servers.listMine);
  const me = useCurrentUser();

  if (servers === undefined) return null;
  const server = servers.find((s) => s._id === id);

  if (!server) {
    return (
      <div className="grid flex-1 place-items-center bg-discord-bg text-discord-muted">
        You are not a member of this server.
      </div>
    );
  }

  const isOwner = server.ownerId === me?._id;

  return (
    <div className="flex min-w-0 flex-1">
      <aside
        aria-label="Channels"
        className="flex w-60 shrink-0 flex-col bg-discord-sidebar"
      >
        <ServerHeader serverId={id} name={server.name} isOwner={isOwner} />
        <div className="flex-1 overflow-y-auto p-2">
          <p className="px-2 py-1 text-xs font-semibold uppercase text-discord-muted">
            Text channels
          </p>
          <p className="mt-6 px-2 text-xs text-discord-muted">
            Channel management &amp; messaging arrive in User Story 3.
          </p>
        </div>
      </aside>

      <main className="grid min-w-0 flex-1 place-items-center bg-discord-bg text-discord-muted">
        <p>Messaging lands in User Story 3.</p>
      </main>

      <MemberList serverId={id} />
    </div>
  );
}
