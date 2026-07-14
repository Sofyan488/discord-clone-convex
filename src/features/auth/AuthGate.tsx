import { ReactNode } from "react";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { Spinner } from "@/components/Spinner";

// Gates the app behind authentication. The unauthenticated placeholder is
// replaced by real Sign Up / Log In screens in User Story 1 (T022/T023).
export function AuthGate({ children }: { children: ReactNode }) {
  return (
    <>
      <AuthLoading>
        <div className="grid h-full w-full place-items-center">
          <Spinner />
        </div>
      </AuthLoading>

      <Unauthenticated>
        <div className="grid h-full w-full place-items-center p-8 text-center">
          <div>
            <h1 className="mb-2 text-2xl font-bold">Discord Clone</h1>
            <p className="text-discord-muted">
              Authentication UI arrives in User Story 1.
            </p>
          </div>
        </div>
      </Unauthenticated>

      <Authenticated>{children}</Authenticated>
    </>
  );
}
