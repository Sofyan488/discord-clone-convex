import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { MessageItem, ChannelMessage } from "@/features/messages/MessageItem";
import type { Id } from "@convex/_generated/dataModel";

const base: ChannelMessage = {
  _id: "msg1" as Id<"messages">,
  authorId: "user1" as Id<"users">,
  authorName: "Alice",
  content: "hello world",
  _creationTime: 1_700_000_000_000,
};

describe("MessageItem", () => {
  test("renders author, content, and the edited marker", () => {
    const { rerender } = render(
      <MessageItem message={base} isOwn={false} onEdit={vi.fn()} onDelete={vi.fn()} />,
    );
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("hello world")).toBeInTheDocument();
    expect(screen.queryByText("(edited)")).toBeNull();

    rerender(
      <MessageItem
        message={{ ...base, editedAt: base._creationTime + 1000 }}
        isOwn={false}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("(edited)")).toBeInTheDocument();
  });

  test("edit/delete controls only render for the author", () => {
    const { rerender } = render(
      <MessageItem message={base} isOwn={false} onEdit={vi.fn()} onDelete={vi.fn()} />,
    );
    expect(screen.queryByRole("button", { name: "Edit message" })).toBeNull();

    rerender(
      <MessageItem message={base} isOwn={true} onEdit={vi.fn()} onDelete={vi.fn()} />,
    );
    expect(
      screen.getByRole("button", { name: "Edit message" }),
    ).toBeInTheDocument();
  });

  test("editing saves the new content via onEdit", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn().mockResolvedValue(undefined);
    render(
      <MessageItem message={base} isOwn={true} onEdit={onEdit} onDelete={vi.fn()} />,
    );
    await user.click(screen.getByRole("button", { name: "Edit message" }));
    const box = screen.getByRole("textbox");
    await user.clear(box);
    await user.type(box, "updated text");
    await user.click(screen.getByRole("button", { name: "save" }));
    expect(onEdit).toHaveBeenCalledWith(base._id, "updated text");
  });

  test("delete calls onDelete after confirmation", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(
      <MessageItem message={base} isOwn={true} onEdit={vi.fn()} onDelete={onDelete} />,
    );
    await user.click(screen.getByRole("button", { name: "Delete message" }));
    expect(onDelete).toHaveBeenCalledWith(base._id);
  });
});
