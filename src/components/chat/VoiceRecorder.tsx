import { useEffect, useRef, useState } from "react";
import { Mic, Send, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

function format(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function VoiceRecorder({
  disabled,
  onRecorded,
}: {
  disabled?: boolean;
  onRecorded: (file: File) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [preview, setPreview] = useState<{ url: string; file: File } | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      recorder.onstop = () => {
        const type = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        const ext = type.includes("mp4") ? "m4a" : "webm";
        const file = new File([blob], `voice-${Date.now()}.${ext}`, { type });
        setPreview({ url: URL.createObjectURL(blob), file });
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      toast.error("Microphone unavailable", { description: "Allow microphone access to record." });
    }
  };

  const stop = () => {
    recorderRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  if (preview) {
    return (
      <div className="flex w-full items-center gap-2 rounded-xl border border-border bg-secondary/40 p-2">
        <audio src={preview.url} controls className="h-9 flex-1" />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Discard voice message"
          onClick={() => setPreview(null)}
        >
          <Trash2 className="size-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          aria-label="Send voice message"
          onClick={() => {
            onRecorded(preview.file);
            setPreview(null);
          }}
        >
          <Send className="size-4" />
        </Button>
      </div>
    );
  }

  if (recording) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2">
        <span className="size-2 animate-pulse rounded-full bg-destructive" />
        <span className="text-xs font-semibold tabular-nums">{format(seconds)}</span>
        <Button type="button" size="icon" variant="destructive" onClick={stop} aria-label="Stop recording">
          <Square className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      disabled={disabled}
      onClick={start}
      aria-label="Record voice message"
    >
      <Mic className="size-4" />
    </Button>
  );
}
