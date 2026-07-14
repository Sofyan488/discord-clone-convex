import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// Capture the two typing mutations the hook dispatches.
const setTyping = vi.fn(() => Promise.resolve(null));
const clearTyping = vi.fn(() => Promise.resolve(null));

vi.mock("@convex/_generated/api", () => ({
  api: { typing: { setTyping: "SET", clearTyping: "CLEAR" } },
}));
vi.mock("convex/react", () => ({
  useMutation: (ref: string) => (ref === "SET" ? setTyping : clearTyping),
}));

import { useTyping, type TypingTarget } from "@/hooks/useTyping";

const CH1 = { channelId: "c1" } as unknown as TypingTarget;
const CH2 = { channelId: "c2" } as unknown as TypingTarget;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  setTyping.mockClear();
  clearTyping.mockClear();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("useTyping", () => {
  test("announces typing once per throttle window, then auto-clears when idle", () => {
    const { result } = renderHook(() => useTyping(CH1));

    act(() => result.current.onType());
    expect(setTyping).toHaveBeenCalledTimes(1);

    // A second keystroke inside the throttle window doesn't re-announce.
    act(() => {
      vi.advanceTimersByTime(500);
      result.current.onType();
    });
    expect(setTyping).toHaveBeenCalledTimes(1);
    expect(clearTyping).not.toHaveBeenCalled();

    // After the idle timeout with no keystrokes, the row is cleared.
    act(() => vi.advanceTimersByTime(3000));
    expect(clearTyping).toHaveBeenCalledTimes(1);
  });

  test("stop() clears immediately (send path)", () => {
    const { result } = renderHook(() => useTyping(CH1));
    act(() => result.current.onType());
    act(() => result.current.stop());
    expect(clearTyping).toHaveBeenCalledTimes(1);
  });

  test("clears on unmount (navigating away / closing the composer)", () => {
    const { result, unmount } = renderHook(() => useTyping(CH1));
    act(() => result.current.onType());
    clearTyping.mockClear();
    unmount();
    expect(clearTyping).toHaveBeenCalledTimes(1);
  });

  test("clears the previous target when switching channel/DM", () => {
    const { result, rerender } = renderHook(
      ({ target }: { target: TypingTarget }) => useTyping(target),
      { initialProps: { target: CH1 } },
    );
    act(() => result.current.onType());
    clearTyping.mockClear();

    rerender({ target: CH2 });
    // The old channel's indicator is cleared exactly once by the effect cleanup.
    expect(clearTyping).toHaveBeenCalledTimes(1);
  });
});
