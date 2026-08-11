import { useQuery } from "@tanstack/react-query";
import { FileDown, Loader2 } from "lucide-react";

import { getSignedUrl } from "@/lib/media";
import type { ChatAttachmentKind } from "@/lib/media";
import { cn } from "@/lib/utils";

export function ChatAttachment({
  path,
  kind,
  className,
}: {
  path: string;
  kind: ChatAttachmentKind;
  className?: string;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["signed-url", path],
    queryFn: () => getSignedUrl(path),
    staleTime: 50 * 60 * 1000,
  });

  if (isLoading)
    return (
      <div className="flex items-center gap-2 py-2 text-xs opacity-70">
        <Loader2 className="size-3.5 animate-spin" /> Loading attachment…
      </div>
    );
  if (!data) return <p className="py-2 text-xs opacity-70">Attachment unavailable</p>;

  if (kind === "photo") {
    return (
      <a href={data} target="_blank" rel="noopener noreferrer">
        <img
          src={data}
          alt="Shared photo"
          loading="lazy"
          className={cn("max-h-72 w-full rounded-xl object-cover", className)}
        />
      </a>
    );
  }

  if (kind === "video") {
    return (
      <video
        src={data}
        controls
        playsInline
        preload="metadata"
        className={cn("max-h-72 w-full rounded-xl bg-black", className)}
      />
    );
  }

  if (kind === "audio") {
    return <audio src={data} controls preload="metadata" className={cn("w-56 max-w-full", className)} />;
  }

  return (
    <a
      href={data}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 rounded-lg bg-background/30 px-3 py-2 text-xs font-medium underline-offset-2 hover:underline"
    >
      <FileDown className="size-4" /> Download file
    </a>
  );
}
