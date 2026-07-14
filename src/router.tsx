import { createBrowserRouter, Navigate } from "react-router-dom";
import { App } from "./App";
import { AuthGate } from "./features/auth/AuthGate";

// Route table. Feature routes (invite accept, DMs, channels) are added by their
// respective user-story phases; the foundational shell provides the protected
// layout behind the auth gate.
export const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <AuthGate>
        <App />
      </AuthGate>
    ),
    children: [
      // Placeholder index; channel/DM routes added in US3/US4.
      { index: true, element: <Navigate to="/channels/@me" replace /> },
      { path: "channels/*", element: null },
    ],
  },
]);
