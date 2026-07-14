import { createBrowserRouter } from "react-router-dom";
import { App } from "./App";
import { AuthGate } from "./features/auth/AuthGate";
import { ServersHome } from "./features/servers/ServersHome";
import { ServerView } from "./features/servers/ServerView";
import { JoinByInvite } from "./features/servers/JoinByInvite";

export const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <AuthGate>
        <App />
      </AuthGate>
    ),
    children: [
      { index: true, element: <ServersHome /> },
      { path: "servers/:serverId", element: <ServerView /> },
      { path: "invite/:code", element: <JoinByInvite /> },
    ],
  },
]);
