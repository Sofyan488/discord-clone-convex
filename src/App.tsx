import { Outlet } from "react-router-dom";

// Discord-style four-region layout. Feature phases fill each region:
//  - server rail (US2), channel sidebar (US3), main area (US3/US4/US5),
//    member list (US1 presence + US2 membership).
export function App() {
  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Server rail */}
      <nav
        aria-label="Servers"
        className="flex w-[72px] shrink-0 flex-col items-center gap-2 bg-discord-rail py-3"
      >
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-discord-accent font-bold text-white">
          DC
        </div>
      </nav>

      {/* Channel sidebar */}
      <aside
        aria-label="Channels"
        className="flex w-60 shrink-0 flex-col bg-discord-sidebar"
      >
        <div className="flex h-12 items-center px-4 font-semibold shadow">
          Select a server
        </div>
      </aside>

      {/* Main area */}
      <main className="flex min-w-0 flex-1 flex-col bg-discord-bg">
        <Outlet />
      </main>

      {/* Member list */}
      <aside
        aria-label="Members"
        className="hidden w-60 shrink-0 flex-col bg-discord-member lg:flex"
      />
    </div>
  );
}
