import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { MeshManager } from "@/lib/webrtc/MeshManager";
import { useHeartbeat } from "./useHeartbeat";
import { useCurrentUser } from "./useCurrentUser";

export type CallTarget =
  | { channelId: Id<"channels"> }
  | { threadId: Id<"directMessageThreads"> };

export type CallStatus = "joining" | "connected" | "denied" | "error";

export type CallParticipant = {
  userId: Id<"users">;
  name: string;
  avatarUrl?: string;
  micEnabled: boolean;
  cameraEnabled: boolean;
  speaking: boolean;
  isLocal: boolean;
  stream?: MediaStream;
};

// Orchestrates a full-mesh call: media capture, join/leave, signaling bridge,
// heartbeat, speaking detection, and mic/camera toggles.
export function useCall(target: CallTarget) {
  const me = useCurrentUser();
  const myId = me?._id;
  const targetKey = "channelId" in target ? target.channelId : target.threadId;

  const state = useQuery(api.calls.getState, target);
  const callId = state?.callId;
  const signals =
    useQuery(api.signals.receive, callId ? { callId } : "skip") ?? [];

  const join = useMutation(api.calls.join);
  const leave = useMutation(api.calls.leave);
  const setMedia = useMutation(api.calls.setMedia);
  const heartbeat = useMutation(api.calls.heartbeat);
  const sendSignal = useMutation(api.signals.send);
  const ackSignals = useMutation(api.signals.ack);

  const [status, setStatus] = useState<CallStatus>("joining");
  const [error, setError] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(
    new Map(),
  );
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(false);

  const meshRef = useRef<MeshManager | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const callIdRef = useRef<Id<"calls"> | null>(null);
  const micEnabledRef = useRef(true);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const speakingTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    callIdRef.current = callId ?? null;
  }, [callId]);

  // Join + media + mesh lifecycle (runs once per target/identity).
  useEffect(() => {
    if (!myId) return;
    let cancelled = false;

    const cleanup = () => {
      if (speakingTimer.current) clearInterval(speakingTimer.current);
      speakingTimer.current = null;
      void audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;
      meshRef.current?.close();
      meshRef.current = null;
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      const cid = callIdRef.current;
      if (cid) void leave({ callId: cid });
    };

    (async () => {
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true,
        });
      } catch {
        if (!cancelled) setStatus("denied");
      }
      if (cancelled) {
        stream?.getTracks().forEach((t) => t.stop());
        return;
      }
      if (stream) {
        stream.getVideoTracks().forEach((t) => (t.enabled = false)); // camera off
        localStreamRef.current = stream;
        setLocalStream(stream);
        startSpeakingDetection(stream);
      }

      const mesh = new MeshManager(myId, stream, {
        sendSignal: (to, kind, payload) => {
          const cid = callIdRef.current;
          if (cid) {
            void sendSignal({
              callId: cid,
              toUserId: to as Id<"users">,
              kind,
              payload,
            });
          }
        },
        onRemoteStream: (uid, s) =>
          setRemoteStreams((prev) => new Map(prev).set(uid, s)),
      });
      meshRef.current = mesh;

      try {
        const res = await join(target);
        callIdRef.current = res.callId;
        if (!cancelled) setStatus("connected");
      } catch {
        if (!cancelled) {
          setStatus("error");
          setError("Could not join the call.");
        }
      }
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myId, targetKey]);

  // Reconcile peer connections with the live participant list.
  useEffect(() => {
    if (!meshRef.current || !state) return;
    meshRef.current.syncPeers(state.participants.map((p) => p.userId));
  }, [state]);

  // Apply inbound signals, then acknowledge (delete) them.
  useEffect(() => {
    if (!meshRef.current || signals.length === 0) return;
    const ids = signals.map((s) => s._id);
    (async () => {
      for (const s of signals) {
        try {
          await meshRef.current!.handleSignal(s.fromUserId, s.kind, s.payload);
        } catch {
          // ignore malformed/expired signals
        }
      }
      await ackSignals({ signalIds: ids });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signals]);

  // In-call heartbeat so ghosts can be reaped server-side.
  useHeartbeat(
    () => {
      const cid = callIdRef.current;
      if (cid) void heartbeat({ callId: cid });
    },
    10_000,
    status === "connected",
  );

  function startSpeakingDetection(stream: MediaStream) {
    try {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new Ctor();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      let last = false;
      speakingTimer.current = setInterval(() => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        const speaking = micEnabledRef.current && avg > 15;
        if (speaking !== last) {
          last = speaking;
          const cid = callIdRef.current;
          if (cid) void setMedia({ callId: cid, speaking });
        }
      }, 300);
    } catch {
      // WebAudio unavailable — speaking indicator simply won't update.
    }
  }

  function toggleMic() {
    const next = !micEnabled;
    setMicEnabled(next);
    micEnabledRef.current = next;
    localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = next));
    const cid = callIdRef.current;
    if (cid) void setMedia({ callId: cid, micEnabled: next });
  }

  function toggleCamera() {
    const next = !cameraEnabled;
    setCameraEnabled(next);
    localStreamRef.current?.getVideoTracks().forEach((t) => (t.enabled = next));
    const cid = callIdRef.current;
    if (cid) void setMedia({ callId: cid, cameraEnabled: next });
  }

  // Merge server roster with local/remote media streams for rendering.
  const participants: CallParticipant[] = (state?.participants ?? []).map(
    (p) => ({
      ...p,
      isLocal: p.userId === myId,
      stream:
        p.userId === myId
          ? (localStream ?? undefined)
          : remoteStreams.get(p.userId),
    }),
  );

  return {
    status,
    error,
    participants,
    micEnabled,
    cameraEnabled,
    toggleMic,
    toggleCamera,
  };
}
