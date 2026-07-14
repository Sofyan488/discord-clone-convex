import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { CreateServerModal } from "./CreateServerModal";
import { AccountSettings } from "@/features/auth/AccountSettings";

// Left-most rail: one button per server + create + account settings.
export function ServerRail() {
  const servers = useQuery(api.servers.listMine) ?? [];
  const [creating, setCreating] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <nav
      aria-label="Servers"
      className="flex w-[72px] shrink-0 flex-col items-center gap-2 bg-discord-rail py-3"
    >
      <NavLink
        to="/dms"
        title="Direct Messages"
        className={({ isActive }) =>
          `grid h-12 w-12 place-items-center rounded-[24px] text-xl transition-all hover:rounded-2xl ${
            isActive
              ? "rounded-2xl bg-discord-accent text-white"
              : "bg-discord-sidebar text-discord-text hover:bg-discord-accent hover:text-white"
          }`
        }
      >
        💬
      </NavLink>
      <div className="my-1 h-0.5 w-8 rounded bg-white/10" />
      {servers.map((s) => (
        <NavLink
          key={s._id}
          to={`/servers/${s._id}`}
          title={s.name}
          className={({ isActive }) =>
            `grid h-12 w-12 place-items-center rounded-[24px] text-sm font-semibold transition-all hover:rounded-2xl ${
              isActive
                ? "rounded-2xl bg-discord-accent text-white"
                : "bg-discord-sidebar text-discord-text hover:bg-discord-accent hover:text-white"
            }`
          }
        >
          {s.name.slice(0, 2).toUpperCase()}
        </NavLink>
      ))}

      <button
        onClick={() => setCreating(true)}
        title="Create a server"
        aria-label="Create a server"
        className="grid h-12 w-12 place-items-center rounded-[24px] bg-discord-sidebar text-2xl text-discord-online transition-all hover:rounded-2xl hover:bg-discord-online hover:text-white"
      >
        +
      </button>

      <div className="mt-auto">
        <button
          onClick={() => setSettingsOpen(true)}
          title="User settings"
          aria-label="User settings"
          className="grid h-12 w-12 place-items-center rounded-full bg-discord-sidebar text-lg hover:bg-white/10"
        >
          ⚙
        </button>
      </div>

      <CreateServerModal open={creating} onClose={() => setCreating(false)} />
      <AccountSettings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </nav>
  );
}
