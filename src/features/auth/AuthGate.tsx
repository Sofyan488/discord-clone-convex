import { ReactNode } from "react";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { Spinner } from "@/components/Spinner";
import { AuthScreen } from "./AuthScreen";

// Gates the app behind authentication.
export function AuthGate({ children }: { children: ReactNode }) {
  return (
    <>
      <AuthLoading>
        <div className="grid h-full w-full place-items-center">
          <Spinner />
        </div>
      </AuthLoading>

      <Unauthenticated>
        <AuthScreen />
      </Unauthenticated>

      <Authenticated>{children}</Authenticated>
    </>
  );
}
