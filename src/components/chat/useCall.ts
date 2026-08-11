import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

export type CallMode = "audio" | "video";
export type CallState =
  | { phase: "idle" }
  | { phase: "calling"; mode: CallMode }
  | { phase: "incoming"; mode: CallMode; from: string }
  | { phase: "connected"; mode: CallMode };

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:global.stun.twilio.com:3478"] }],
};

type Payload = {
  type: "offer" | "answer" | "ice" | "end" | "decline";
  from: string;
  mode?: CallMode;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
};

/** 1:1 WebRTC audio/video calling signalled over a Realtime channel for the conversation. */
export function useCall(conversationId: string, meId: string) {
  const [state, setState] = useState<CallState>({ phase: "idle" });
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const pendingOffer = useRef<RTCSessionDescriptionInit | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const send = useCallback(
    (payload: Omit<Payload, "from">) => {
      void channelRef.current?.send({
        type: "broadcast",
        event: "signal",
        payload: { ...payload, from: meId } satisfies Payload,
      });
    },
    [meId],
  );

  const teardown = useCallback(() => {
    pcRef.current?.getSenders().forEach((s) => s.track?.stop());
    pcRef.current?.close();
    pcRef.current = null;
    localRef.current?.getTracks().forEach((t) => t.stop());
    localRef.current = null;
    pendingOffer.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setMuted(false);
    setCameraOff(false);
    setState({ phase: "idle" });
  }, []);

  const createPeer = useCallback(
    (mode: CallMode) => {
      const pc = new RTCPeerConnection(ICE_SERVERS);
      pc.onicecandidate = (e) => {
        if (e.candidate) send({ type: "ice", candidate: e.candidate.toJSON() });
      };
      pc.ontrack = (e) => {
        const [stream] = e.streams;
        if (stream) setRemoteStream(stream);
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") setState({ phase: "connected", mode });
        if (pc.connectionState === "failed" || pc.connectionState === "disconnected") teardown();
      };
      pcRef.current = pc;
      return pc;
    },
    [send, teardown],
  );

  const getMedia = useCallback(async (mode: CallMode) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: mode === "video" ? { facingMode: "user" } : false,
    });
    localRef.current = stream;
    setLocalStream(stream);
    return stream;
  }, []);

  useEffect(() => {
    if (!conversationId || !meId) return;
    const channel = supabase.channel(`call:${conversationId}`, { config: { broadcast: { self: false } } });
    channel
      .on("broadcast", { event: "signal" }, async ({ payload }) => {
        const msg = payload as Payload;
        if (msg.from === meId) return;

        if (msg.type === "offer" && msg.sdp) {
          pendingOffer.current = msg.sdp;
          setState({ phase: "incoming", mode: msg.mode ?? "audio", from: msg.from });
          return;
        }
        if (msg.type === "answer" && msg.sdp && pcRef.current) {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          return;
        }
        if (msg.type === "ice" && msg.candidate && pcRef.current) {
          try {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(msg.candidate));
          } catch {
            /* candidate arrived too early — safe to ignore */
          }
          return;
        }
        if (msg.type === "end" || msg.type === "decline") {
          if (msg.type === "decline") toast.info("Call declined");
          teardown();
        }
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      void supabase.removeChannel(channel);
      channelRef.current = null;
      teardown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, meId]);

  const startCall = useCallback(
    async (mode: CallMode) => {
      try {
        setState({ phase: "calling", mode });
        const stream = await getMedia(mode);
        const pc = createPeer(mode);
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        send({ type: "offer", sdp: offer, mode });
      } catch {
        toast.error("Couldn't start the call", { description: "Check camera/microphone permissions." });
        teardown();
      }
    },
    [createPeer, getMedia, send, teardown],
  );

  const acceptCall = useCallback(async () => {
    if (state.phase !== "incoming" || !pendingOffer.current) return;
    const mode = state.mode;
    try {
      const stream = await getMedia(mode);
      const pc = createPeer(mode);
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      await pc.setRemoteDescription(new RTCSessionDescription(pendingOffer.current));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      send({ type: "answer", sdp: answer, mode });
      setState({ phase: "connected", mode });
    } catch {
      toast.error("Couldn't join the call");
      teardown();
    }
  }, [state, getMedia, createPeer, send, teardown]);

  const declineCall = useCallback(() => {
    send({ type: "decline" });
    teardown();
  }, [send, teardown]);

  const endCall = useCallback(() => {
    send({ type: "end" });
    teardown();
  }, [send, teardown]);

  const toggleMute = useCallback(() => {
    const track = localRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMuted(!track.enabled);
  }, []);

  const toggleCamera = useCallback(() => {
    const track = localRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCameraOff(!track.enabled);
  }, []);

  return useMemo(
    () => ({
      state,
      localStream,
      remoteStream,
      muted,
      cameraOff,
      startCall,
      acceptCall,
      declineCall,
      endCall,
      toggleMute,
      toggleCamera,
    }),
    [
      state,
      localStream,
      remoteStream,
      muted,
      cameraOff,
      startCall,
      acceptCall,
      declineCall,
      endCall,
      toggleMute,
      toggleCamera,
    ],
  );
}
