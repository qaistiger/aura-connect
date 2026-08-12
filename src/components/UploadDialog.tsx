import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Clapperboard, Globe2, Lock, UploadCloud, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { buildMediaPath, validateMedia, type MediaKind } from "@/lib/media";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export function UploadDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState<MediaKind>("photo");
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [visibility, setVisibility] = useState<"public" | "only_me">("public");
  const [isShort, setIsShort] = useState(false);
  const [progress, setProgress] = useState(0);

  const reset = () => {
    setFile(null);
    setPreview(null);
    setCaption("");
    setVisibility("public");
    setIsShort(false);
    setProgress(0);
  };

  const pick = (selected: File | undefined) => {
    if (!selected) return;
    const result = validateMedia(selected);
    if (!result.ok) {
      toast.error("Invalid file", { description: result.error });
      return;
    }
    setFile(selected);
    setKind(result.kind);
    setIsShort(result.kind === "video");
    setPreview(URL.createObjectURL(selected));
  };

  const publish = useMutation({
    mutationFn: async () => {
      if (!user || !file) throw new Error("missing");
      const path = buildMediaPath(user.id, file);
      setProgress(35);
      const { error: uploadError } = await supabase.storage
        .from("media")
        .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
      if (uploadError) throw uploadError;
      setProgress(75);
      const { error } = await supabase.from("posts").insert({
        user_id: user.id,
        media_kind: kind,
        media_path: path,
        bucket: "media",
        caption: caption.trim().slice(0, 2200),
        visibility,
        is_short: kind === "video" ? isShort : false,
      });
      if (error) {
        await supabase.storage.from("media").remove([path]);
        throw error;
      }
      setProgress(100);
    },
    onSuccess: () => {
      toast.success("Published", {
        description: visibility === "public" ? "Your post is live." : "Saved privately — only you can see it.",
      });
      reset();
      onOpenChange(false);
      queryClient.invalidateQueries();
    },
    onError: () => {
      setProgress(0);
      toast.error("Upload failed", { description: "Check your connection and try again." });
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!publish.isPending) {
          if (!v) reset();
          onOpenChange(v);
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New post</DialogTitle>
          <DialogDescription>Photos up to 10 MB, videos up to 100 MB.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!file ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex w-full flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-secondary/30 px-6 py-10 text-center transition-colors hover:border-primary hover:bg-secondary/50"
            >
              <UploadCloud className="size-8 text-primary" />
              <span className="text-sm font-medium">Choose a photo or video</span>
              <span className="text-xs text-muted-foreground">JPG · PNG · WEBP · GIF · MP4 · WEBM · MOV</span>
            </button>
          ) : (
            <div className="relative overflow-hidden rounded-xl border border-border bg-background/60">
              <Button
                variant="secondary"
                size="icon"
                className="absolute top-2 right-2 z-10"
                onClick={reset}
                aria-label="Remove file"
              >
                <X className="size-4" />
              </Button>
              {kind === "photo" ? (
                <img src={preview ?? ""} alt="Selected preview" className="max-h-72 w-full object-contain" />
              ) : (
                <video src={preview ?? ""} controls className="max-h-72 w-full" />
              )}
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*,video/*"
            hidden
            onChange={(e) => pick(e.target.files?.[0])}
          />

          <div className="space-y-2">
            <Label htmlFor="caption">Caption</Label>
            <Textarea
              id="caption"
              value={caption}
              maxLength={2200}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Say something about this…"
            />
          </div>

          {kind === "video" && file ? (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary/30 p-3">
              <Clapperboard className="size-5 text-accent" />
              <div className="min-w-0 flex-1">
                <Label htmlFor="short-toggle" className="text-sm font-semibold">
                  Publish as a Short
                </Label>
                <p className="text-xs text-muted-foreground">
                  Shorts appear in the vertical Shorts feed and on your Shorts tab.
                </p>
              </div>
              <Switch id="short-toggle" checked={isShort} onCheckedChange={setIsShort} />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>Who can see this?</Label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { key: "public", icon: Globe2, title: "Public", desc: "Visible in feeds and search" },
                  { key: "only_me", icon: Lock, title: "Only me", desc: "Private to your account" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setVisibility(opt.key)}
                  className={cn(
                    "rounded-xl border p-3 text-left transition-colors",
                    visibility === opt.key
                      ? "border-primary bg-primary/10"
                      : "border-border bg-secondary/30 hover:bg-secondary/60",
                  )}
                >
                  <opt.icon className="mb-1 size-4 text-primary" />
                  <p className="text-sm font-semibold">{opt.title}</p>
                  <p className="text-xs text-muted-foreground">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {publish.isPending ? <Progress value={progress} /> : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={publish.isPending}>
            Cancel
          </Button>
          <Button onClick={() => publish.mutate()} disabled={!file || publish.isPending}>
            {publish.isPending ? "Publishing…" : "Publish"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
