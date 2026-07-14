import { useCall, CallTarget } from "@/hooks/useCall";
import { Button } from "@/components/Button";
import { Spinner } from "@/components/Spinner";
import { VideoTile } from "./VideoTile";

// Active call surface: participant tiles + mic/camera/leave controls.
// STUN-only in v1 (no TURN) — a peer behind symmetric NAT may fail to connect.
export function CallView({
  target,
  title,
  onLeave,
}: {
  target: CallTarget;
  title: string;
  onLeave: () => void;
}) {
  const {
    status,
    error,
    participants,
    micEnabled,
    cameraEnabled,
    toggleMic,
    toggleCamera,
  } = useCall(target);

  return (
    <div className="flex h-full flex-col bg-black/40">
      <div className="flex h-12 shrink-0 items-center gap-2 px-4 font-semibold">
        🔊 {title}
        {status === "joining" && (
          <span className="ml-2 inline-flex items-center gap-2 text-sm text-discord-muted">
            <Spinner label="Connecting" /> connecting…
          </span>
        )}
      </div>

      {status === "denied" && (
        <div className="mx-4 mb-2 rounded bg-discord-danger/20 p-2 text-sm text-discord-text">
          Microphone/camera permission was denied. Allow access in your browser
          to be heard and seen; you can still see and hear others.
        </div>
      )}
      {status === "error" && error && (
        <div className="mx-4 mb-2 rounded bg-discord-danger/20 p-2 text-sm">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        {participants.length === 0 ? (
          <div className="grid h-full place-items-center text-discord-muted">
            Waiting for others to join…
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {participants.map((p) => (
              <VideoTile key={p.userId} participant={p} />
            ))}
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-center gap-3 py-3">
        <Button variant="secondary" onClick={toggleMic}>
          {micEnabled ? "Mute" : "Unmute"}
        </Button>
        <Button variant="secondary" onClick={toggleCamera}>
          {cameraEnabled ? "Stop Video" : "Start Video"}
        </Button>
        <Button variant="danger" onClick={onLeave}>
          Leave
        </Button>
      </div>

      <p className="pb-2 text-center text-[11px] text-discord-muted">
        v1: full-mesh (up to 4), STUN only — no TURN relay, so calls may fail on
        restrictive networks.
      </p>
    </div>
  );
}
