import { useMutation, useQuery } from "convex/react";
import { useNavigate } from "react-router-dom";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Avatar } from "@/components/Avatar";
import { useCurrentUser } from "@/hooks/useCurrentUser";

// Right-side member list with presence (FR-010). The owner can remove members;
// any member can start a DM with another member (FR-025).
export function MemberList({ serverId }: { serverId: Id<"servers"> }) {
  const me = useCurrentUser();
  const members = useQuery(api.presence.listForServer, { serverId });
  const removeMember = useMutation(api.servers.removeMember);
  const startThread = useMutation(api.directMessages.startThread);
  const navigate = useNavigate();

  if (members === undefined) return null;

  const viewerIsOwner = members.some(
    (m) => m.userId === me?._id && m.role === "owner",
  );
  const online = members.filter((m) => m.online);
  const offline = members.filter((m) => !m.online);

  async function onRemove(userId: Id<"users">, name: string) {
    if (!window.confirm(`Remove ${name} from the server?`)) return;
    await removeMember({ serverId, userId });
  }

  async function onMessage(userId: Id<"users">) {
    const { threadId } = await startThread({ otherUserId: userId });
    navigate(`/dms/${threadId}`);
  }

  const Group = ({
    label,
    list,
  }: {
    label: string;
    list: typeof online;
  }) =>
    list.length === 0 ? null : (
      <div className="mb-4">
        <h3 className="mb-1 px-2 text-xs font-semibold uppercase text-discord-muted">
          {label} — {list.length}
        </h3>
        <ul>
          {list.map((m) => (
            <li
              key={m.userId}
              className="group flex items-center gap-2 rounded px-2 py-1 hover:bg-white/5"
            >
              <Avatar name={m.name} src={m.avatarUrl} online={m.online} />
              <span className="min-w-0 flex-1 truncate text-sm">
                {m.name}
                {m.role === "owner" && (
                  <span className="ml-1 text-xs text-discord-muted">
                    (owner)
                  </span>
                )}
              </span>
              {m.userId !== me?._id && (
                <button
                  onClick={() => onMessage(m.userId)}
                  className="hidden text-discord-muted hover:text-discord-text group-hover:block"
                  title={`Message ${m.name}`}
                  aria-label={`Message ${m.name}`}
                >
                  💬
                </button>
              )}
              {viewerIsOwner && m.role !== "owner" && (
                <button
                  onClick={() => onRemove(m.userId, m.name)}
                  className="hidden text-discord-muted hover:text-discord-danger group-hover:block"
                  title={`Remove ${m.name}`}
                  aria-label={`Remove ${m.name}`}
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    );

  return (
    <aside
      aria-label="Members"
      className="hidden w-60 shrink-0 flex-col overflow-y-auto bg-discord-member p-3 lg:flex"
    >
      <Group label="Online" list={online} />
      <Group label="Offline" list={offline} />
    </aside>
  );
}
