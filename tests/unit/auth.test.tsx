import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi, beforeEach } from "vitest";

const signIn = vi.fn().mockResolvedValue(undefined);
vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signIn, signOut: vi.fn() }),
}));

import { AuthScreen } from "@/features/auth/AuthScreen";

describe("AuthScreen", () => {
  beforeEach(() => signIn.mockClear());

  test("defaults to sign-up with display name field", () => {
    const { container } = render(<AuthScreen />);
    expect(screen.getByText("Create an account")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign Up" })).toBeInTheDocument();
    expect(container.querySelector('input[name="name"]')).not.toBeNull();
  });

  test("toggles to log-in and hides the display name field", async () => {
    const user = userEvent.setup();
    const { container } = render(<AuthScreen />);
    await user.click(
      screen.getByRole("button", { name: /already have an account/i }),
    );
    expect(screen.getByText("Welcome back!")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log In" })).toBeInTheDocument();
    expect(container.querySelector('input[name="name"]')).toBeNull();
  });

  test("submits credentials through the password provider", async () => {
    const user = userEvent.setup();
    const { container } = render(<AuthScreen />);
    await user.type(container.querySelector('input[name="name"]')!, "Alice");
    await user.type(
      container.querySelector('input[name="email"]')!,
      "alice@test.dev",
    );
    await user.type(
      container.querySelector('input[name="password"]')!,
      "supersecret",
    );
    await user.click(screen.getByRole("button", { name: "Sign Up" }));

    expect(signIn).toHaveBeenCalledTimes(1);
    const [provider, form] = signIn.mock.calls[0];
    expect(provider).toBe("password");
    expect(form).toBeInstanceOf(FormData);
    expect((form as FormData).get("flow")).toBe("signUp");
    expect((form as FormData).get("email")).toBe("alice@test.dev");
  });
});
