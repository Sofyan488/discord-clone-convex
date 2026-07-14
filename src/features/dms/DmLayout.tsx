import { Outlet } from "react-router-dom";
import { DmSidebar } from "./DmSidebar";

// DM area: conversation list + the active conversation (or empty state).
export function DmLayout() {
  return (
    <div className="flex min-w-0 flex-1">
      <DmSidebar />
      <Outlet />
    </div>
  );
}

export function DmEmpty() {
  return (
    <main className="grid min-w-0 flex-1 place-items-center bg-discord-bg text-discord-muted">
      <p>Select a conversation, or message a member from a server.</p>
    </main>
  );
}
