import { Outlet } from "react-router-dom";
import { ServerRail } from "./features/servers/ServerRail";
import { usePresence } from "./hooks/usePresence";

// Authenticated app shell: the server rail is always present; the rest of the
// width is filled by the active route (servers home, a server view, or invite).
export function App() {
  usePresence(true);

  return (
    <div className="flex h-full w-full overflow-hidden">
      <ServerRail />
      <div className="flex min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
