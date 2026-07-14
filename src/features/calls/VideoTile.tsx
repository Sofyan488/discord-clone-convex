import { useEffect, useRef } from "react";
import type { CallParticipant } from "@/hooks/useCall";
import { Avatar } from "@/components/Avatar";

// One participant tile: live video when the camera is on, else an avatar.
// Ring highlights the active speaker; a badge shows muted mics.
export function VideoTile({ participant }: { participant: CallParticipant }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const showVideo = participant.cameraEnabled && !!participant.stream;

  useEffect(() => {
    const el = videoRef.current;
    if (el && participant.stream && el.srcObject !== participant.stream) {
      el.srcObject = participant.stream;
    }
  }, [participant.stream, showVideo]);

  return (
    <div
      className={`relative flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-black ${
        participant.speaking ? "ring-2 ring-discord-online" : ""
      }`}
    >
      {showVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={participant.isLocal}
          className="h-full w-full object-cover"
        />
      ) : (
        <Avatar
          name={participant.name}
          src={participant.avatarUrl}
          size={64}
        />
      )}

      <div className="absolute bottom-1 left-2 flex items-center gap-1 rounded bg-black/50 px-1.5 py-0.5 text-xs text-white">
        {!participant.micEnabled && <span title="Muted">🔇</span>}
        <span>
          {participant.name}
          {participant.isLocal ? " (you)" : ""}
        </span>
      </div>
    </div>
  );
}
