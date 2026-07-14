import { NavLink } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Avatar } from "@/components/Avatar";
import { Spinner } from "@/components/Spinner";

// Left column listing the caller's DM conversations (FR-026a).
export function DmSidebar() {
  const threads = useQuery(api.directMessages.listThreads);

  return (
    <aside
      aria-label="Direct messages"
      className="flex w-60 shrink-0 flex-col bg-discord-sidebar"
    >
      <div className="flex h-12 items-center px-4 font-semibold shadow">
        Direct Messages
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {threads === undefined ? (
          <div className="grid place-items-center py-6">
            <Spinner />
          </div>
        ) : threads.length === 0 ? (
          <p className="px-2 py-4 text-sm text-discord-muted">
            No conversations yet. Start one from a server member.
          </p>
        ) : (
          <ul>
            {threads.map((t) => (
              <li key={t.threadId}>
                <NavLink
                  to={`/dms/${t.threadId}`}
                  className={({ isActive }) =>
                    `flex items-center gap-2 rounded px-2 py-1.5 text-sm ${
                      isActive
                        ? "bg-white/10 text-white"
                        : "text-discord-muted hover:bg-white/5 hover:text-discord-text"
                    }`
                  }
                >
                  <Avatar
                    name={t.otherUser.name}
                    src={t.otherUser.avatarUrl}
                    online={t.otherUser.online}
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {t.otherUser.name}
                  </span>
                </NavLink>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
