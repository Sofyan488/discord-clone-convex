import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/Button";
import { Spinner } from "@/components/Spinner";

// Invite-accept screen at /invite/:code (FR-009).
export function JoinByInvite() {
  const { code } = useParams();
  const inviteCode = code ?? "";
  const preview = useQuery(api.servers.getInvitePreview, { inviteCode });
  const join = useMutation(api.servers.joinByInvite);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  if (preview === undefined) {
    return (
      <div className="grid flex-1 place-items-center bg-discord-bg">
        <Spinner />
      </div>
    );
  }

  if (preview === null) {
    return (
      <div className="grid flex-1 place-items-center bg-discord-bg p-8 text-center">
        <div>
          <h1 className="mb-2 text-xl font-bold">Invalid invite</h1>
          <p className="mb-4 text-discord-muted">
            This invite is invalid or the server no longer exists.
          </p>
          <Button variant="secondary" onClick={() => navigate("/")}>
            Go home
          </Button>
        </div>
      </div>
    );
  }

  async function onJoin() {
    setBusy(true);
    try {
      const { serverId } = await join({ inviteCode });
      navigate(`/servers/${serverId}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid flex-1 place-items-center bg-discord-bg p-8 text-center">
      <div>
        <p className="mb-1 text-discord-muted">You&apos;ve been invited to</p>
        <h1 className="mb-1 text-2xl font-bold">{preview.name}</h1>
        <p className="mb-5 text-sm text-discord-muted">
          {preview.memberCount} member{preview.memberCount === 1 ? "" : "s"}
        </p>
        <Button onClick={onJoin} disabled={busy}>
          {busy ? "Joining…" : "Accept invite"}
        </Button>
      </div>
    </div>
  );
}
