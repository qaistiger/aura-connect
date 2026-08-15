import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Mic, MicOff, Search } from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

function getRecognition(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

export function GlobalSearch({
  className,
  initialValue = "",
  onSearch,
  placeholder = "Search people, posts, videos and reels",
  autoSubmitVoice = true,
}: {
  className?: string;
  initialValue?: string;
  onSearch?: (value: string) => void;
  placeholder?: string;
  autoSubmitVoice?: boolean;
}) {
  const navigate = useNavigate();
  const [term, setTerm] = useState(initialValue);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => setTerm(initialValue), [initialValue]);

  useEffect(() => () => recognitionRef.current?.stop(), []);

  const submit = (value: string) => {
    const q = value.trim();
    if (onSearch) {
      onSearch(q);
      return;
    }
    void navigate({ to: "/explore", search: { q: q || undefined } });
  };

  const toggleVoice = () => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const recognition = getRecognition();
    if (!recognition) {
      toast.error("Voice search isn't supported", {
        description: "Try Chrome, Edge or Safari on this device.",
      });
      return;
    }
    recognitionRef.current = recognition;
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript ?? "";
      if (!transcript) return;
      setTerm(transcript);
      if (autoSubmitVoice) submit(transcript);
    };
    recognition.onerror = () => {
      setListening(false);
      toast.error("Couldn't hear that", { description: "Check microphone permissions and try again." });
    };
    recognition.onend = () => setListening(false);
    setListening(true);
    recognition.start();
  };

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        submit(term);
      }}
      className={cn("relative flex w-full items-center gap-2", className)}
    >
      <div className="relative flex-1">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder={placeholder}
          aria-label="Search"
          className="pr-3 pl-9"
        />
      </div>
      <Button
        type="button"
        size="icon"
        variant={listening ? "default" : "secondary"}
        onClick={toggleVoice}
        aria-label={listening ? "Stop voice search" : "Start voice search"}
        title="Voice search"
      >
        {listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
      </Button>
    </form>
  );
}
