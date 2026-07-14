import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";

// Index view when no server is selected.
export function ServersHome() {
  const servers = useQuery(api.servers.listMine);

  return (
    <div className="grid flex-1 place-items-center bg-discord-bg p-8 text-center">
      <div>
        <h1 className="mb-2 text-2xl font-bold">Welcome to Discord Clone</h1>
        <p className="text-discord-muted">
          {servers && servers.length > 0
            ? "Pick a server from the left, or create another with the + button."
            : "Create your first server with the + button on the left."}
        </p>
      </div>
    </div>
  );
}
