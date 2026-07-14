import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/Button";
import { Avatar } from "@/components/Avatar";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export function AccountSettings({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const me = useCurrentUser();
  const { signOut } = useAuthActions();
  const deleteAccount = useMutation(api.users.deleteAccount);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    if (
      !window.confirm(
        "Delete your account? Servers you own will be deleted. This cannot be undone.",
      )
    )
      return;
    setBusy(true);
    try {
      await deleteAccount({});
      await signOut();
      navigate("/");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} title="User settings" onClose={onClose}>
      {me && (
        <div className="mb-5 flex items-center gap-3">
          <Avatar name={me.name} src={me.avatarUrl} size={48} />
          <div>
            <div className="font-semibold">{me.name}</div>
            <div className="text-sm text-discord-muted">{me.email}</div>
          </div>
        </div>
      )}
      <div className="flex flex-col gap-2">
        <Button variant="secondary" onClick={() => void signOut()}>
          Log Out
        </Button>
        <Button variant="danger" onClick={onDelete} disabled={busy}>
          {busy ? "Deleting…" : "Delete Account"}
        </Button>
      </div>
    </Modal>
  );
}
