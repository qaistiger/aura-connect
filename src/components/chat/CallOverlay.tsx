import { useEffect, useRef } from "react";
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/UserAvatar";
import type { useCall } from "@/components/chat/useCall";
import { cn } from "@/lib/utils";

type Call = ReturnType<typeof useCall>;

function StreamVideo({
  stream,
  muted,
  className,
}: {
  stream: MediaStream | null;
  muted?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && stream) ref.current.srcObject = stream;
  }, [stream]);
  return <video ref={ref} autoPlay playsInline muted={muted} className={className} />;
}

export function CallOverlay({
  call,
  peerName,
  peerAvatar,
}: {
  call: Call;
  peerName: string;
  peerAvatar: string | null;
}) {
  const { state } = call;
  if (state.phase === "idle") return null;

  const isVideo = state.mode === "video";
  const label =
    state.phase === "calling"
      ? `Calling ${peerName}…`
      : state.phase === "incoming"
        ? `Incoming ${state.mode} call`
        : peerName;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-xl">
      {isVideo && state.phase === "connected" ? (
        <div className="relative h-full w-full">
          <StreamVideo stream={call.remoteStream} className="h-full w-full bg-black object-cover" />
          <StreamVideo
            stream={call.localStream}
            muted
            className="absolute bottom-28 right-4 h-40 w-28 rounded-xl border border-border object-cover shadow-lg"
          />
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <UserAvatar url={peerAvatar} name={peerName} className="size-24" />
          <p className="font-display text-xl font-extrabold">{label}</p>
          <p className="text-sm text-muted-foreground">
            {state.phase === "connected" ? "Connected" : "Ringing…"}
          </p>
        </div>
      )}



      <audio
        autoPlay
        ref={(el) => {
          if (el && call.remoteStream) el.srcObject = call.remoteStream;
        }}
        className="hidden"
      />

      <div
        className={cn(
          "flex items-center gap-3",
          isVideo && state.phase === "connected"
            ? "absolute bottom-8 left-1/2 -translate-x-1/2"
            : "mt-10",
        )}
      >
        {state.phase === "incoming" ? (
          <>
            <Button size="lg" className="rounded-full" onClick={() => void call.acceptCall()}>
              <Phone className="size-5" /> Accept
            </Button>
            <Button size="lg" variant="destructive" className="rounded-full" onClick={call.declineCall}>
              <PhoneOff className="size-5" /> Decline
            </Button>
          </>
        ) : (
          <>
            <Button
              size="icon"
              variant="secondary"
              className="size-12 rounded-full"
              onClick={call.toggleMute}
              aria-label={call.muted ? "Unmute" : "Mute"}
            >
              {call.muted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
            </Button>
            {isVideo ? (
              <Button
                size="icon"
                variant="secondary"
                className="size-12 rounded-full"
                onClick={call.toggleCamera}
                aria-label={call.cameraOff ? "Turn camera on" : "Turn camera off"}
              >
                {call.cameraOff ? <VideoOff className="size-5" /> : <Video className="size-5" />}
              </Button>
            ) : null}
            <Button
              size="icon"
              variant="destructive"
              className="size-12 rounded-full"
              onClick={call.endCall}
              aria-label="End call"
            >
              <PhoneOff className="size-5" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
