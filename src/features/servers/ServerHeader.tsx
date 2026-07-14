import { FormEvent, ReactNode, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Modal } from "@/components/Modal";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { InviteModal } from "./InviteModal";

type Props = {
  serverId: Id<"servers">;
  name: string;
  isOwner: boolean;
};

// Server name header with a dropdown of management actions (FR-011, FR-012a, invites).
export function ServerHeader({ serverId, name, isOwner }: Props) {
  const rename = useMutation(api.servers.rename);
  const remove = useMutation(api.servers.remove);
  const leave = useMutation(api.servers.leave);
  const navigate = useNavigate();

  const [menuOpen, setMenuOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [newName, setNewName] = useState(name);

  async function onRename(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    await rename({ serverId, name: newName });
    setRenameOpen(false);
  }

  async function onDelete() {
    if (!window.confirm(`Delete "${name}"? This removes all its channels.`))
      return;
    await remove({ serverId });
    navigate("/");
  }

  async function onLeave() {
    const msg = isOwner
      ? `You own "${name}". Leaving deletes the server. Continue?`
      : `Leave "${name}"?`;
    if (!window.confirm(msg)) return;
    await leave({ serverId });
    navigate("/");
  }

  return (
    <div className="relative">
      <button
        onClick={() => setMenuOpen((v) => !v)}
        className="flex h-12 w-full items-center justify-between px-4 font-semibold shadow hover:bg-white/5"
      >
        <span className="truncate">{name}</span>
        <span className="text-discord-muted">▾</span>
      </button>

      {menuOpen && (
        <div
          role="menu"
          className="absolute left-2 right-2 top-12 z-10 rounded-md bg-discord-rail p-1 text-sm shadow-xl"
          onMouseLeave={() => setMenuOpen(false)}
        >
          <MenuItem
            onSelect={() => {
              setInviteOpen(true);
              setMenuOpen(false);
            }}
          >
            Invite people
          </MenuItem>
          {isOwner && (
            <MenuItem
              onSelect={() => {
                setNewName(name);
                setRenameOpen(true);
                setMenuOpen(false);
              }}
            >
              Rename server
            </MenuItem>
          )}
          {isOwner && (
            <MenuItem danger onSelect={onDelete}>
              Delete server
            </MenuItem>
          )}
          <MenuItem danger onSelect={onLeave}>
            Leave server
          </MenuItem>
        </div>
      )}

      <InviteModal
        serverId={serverId}
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
      />

      <Modal
        open={renameOpen}
        title="Rename server"
        onClose={() => setRenameOpen(false)}
      >
        <form onSubmit={onRename}>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            maxLength={100}
            autoFocus
            className="mb-4"
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setRenameOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!newName.trim()}>
              Save
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function MenuItem({
  onSelect,
  danger,
  children,
}: {
  onSelect: () => void;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      role="menuitem"
      onClick={onSelect}
      className={`block w-full rounded px-2 py-1.5 text-left hover:bg-discord-accent hover:text-white ${
        danger ? "text-discord-danger" : "text-discord-text"
      }`}
    >
      {children}
    </button>
  );
}
