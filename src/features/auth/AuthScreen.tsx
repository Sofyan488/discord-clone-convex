import { FormEvent, useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";

// Combined Sign Up / Log In screen (US1: T022/T023). Uses the Convex Auth
// password provider; sign-up also submits display name + avatar URL.
export function AuthScreen() {
  const { signIn } = useAuthActions();
  const [mode, setMode] = useState<"signIn" | "signUp">("signUp");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const form = new FormData(e.currentTarget);
    form.set("flow", mode);
    try {
      await signIn("password", form);
    } catch {
      setError(
        mode === "signIn"
          ? "Invalid email or password."
          : "Could not create account. Try a different email.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid h-full w-full place-items-center p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-lg bg-discord-sidebar p-6 shadow-xl"
      >
        <h1 className="mb-1 text-center text-xl font-bold">
          {mode === "signIn" ? "Welcome back!" : "Create an account"}
        </h1>
        <p className="mb-5 text-center text-sm text-discord-muted">
          Discord Clone
        </p>

        {mode === "signUp" && (
          <label className="mb-3 block">
            <span className="mb-1 block text-xs font-semibold uppercase text-discord-muted">
              Display name
            </span>
            <Input name="name" required maxLength={80} autoComplete="nickname" />
          </label>
        )}
        {mode === "signUp" && (
          <label className="mb-3 block">
            <span className="mb-1 block text-xs font-semibold uppercase text-discord-muted">
              Avatar URL <span className="normal-case">(optional)</span>
            </span>
            <Input name="avatarUrl" type="url" autoComplete="off" />
          </label>
        )}
        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-semibold uppercase text-discord-muted">
            Email
          </span>
          <Input name="email" type="email" required autoComplete="email" />
        </label>
        <label className="mb-4 block">
          <span className="mb-1 block text-xs font-semibold uppercase text-discord-muted">
            Password
          </span>
          <Input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete={
              mode === "signIn" ? "current-password" : "new-password"
            }
          />
        </label>

        {error && (
          <p role="alert" className="mb-3 text-sm text-discord-danger">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting
            ? "Please wait…"
            : mode === "signIn"
              ? "Log In"
              : "Sign Up"}
        </Button>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "signIn" ? "signUp" : "signIn");
            setError(null);
          }}
          className="mt-4 w-full text-center text-sm text-discord-accent hover:underline"
        >
          {mode === "signIn"
            ? "Need an account? Register"
            : "Already have an account? Log In"}
        </button>
      </form>
    </div>
  );
}
