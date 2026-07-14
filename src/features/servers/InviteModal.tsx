import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Modal } from "@/components/Modal";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";

export function InviteModal({
  serverId,
  open,
  onClose,
}: {
  serverId: Id<"servers">;
  open: boolean;
  onClose: () => void;
}) {
  const invite = useQuery(api.servers.getInvite, open ? { serverId } : "skip");
  const [copied, setCopied] = useState(false);

  const link = invite
    ? `${window.location.origin}/invite/${invite.inviteCode}`
    : "";

  async function copy() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Modal open={open} title="Invite people" onClose={onClose}>
      <p className="mb-2 text-sm text-discord-muted">
        Share this link to grant access to your server.
      </p>
      <div className="flex gap-2">
        <Input readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
        <Button onClick={copy} disabled={!link}>
          {copied ? "Copied!" : "Copy"}
        </Button>
      </div>
    </Modal>
  );
}
