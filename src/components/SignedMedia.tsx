import { useQuery } from "@tanstack/react-query";
import { getSignedUrl } from "@/lib/media";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ImageOff } from "lucide-react";

type Props = {
  path: string;
  kind: "photo" | "video";
  alt: string;
  className?: string;
  controls?: boolean;
};

export function SignedMedia({ path, kind, alt, className, controls = true }: Props) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["signed-url", path],
    queryFn: () => getSignedUrl(path),
    staleTime: 50 * 60 * 1000,
  });

  if (isLoading) return <Skeleton className={cn("aspect-4/5 w-full", className)} />;

  if (isError || !data) {
    return (
      <div
        className={cn(
          "flex aspect-4/5 w-full flex-col items-center justify-center gap-2 bg-muted text-muted-foreground",
          className,
        )}
      >
        <ImageOff className="size-6" />
        <p className="text-xs">Media unavailable</p>
      </div>
    );
  }

  if (kind === "video") {
    return (
      <video
        src={data}
        controls={controls}
        playsInline
        preload="metadata"
        className={cn("w-full bg-black object-contain", className)}
      />
    );
  }

  return (
    <img
      src={data}
      alt={alt}
      loading="lazy"
      className={cn("w-full object-cover", className)}
    />
  );
}
