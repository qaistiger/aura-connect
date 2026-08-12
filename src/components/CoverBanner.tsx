import { useQuery } from "@tanstack/react-query";

import { getSignedUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

function isRemote(url: string) {
  return url.startsWith("http://") || url.startsWith("https://");
}

/** Facebook-style cover banner that resolves storage paths to short-lived signed URLs. */
export function CoverBanner({
  url,
  alt,
  className,
}: {
  url: string | null | undefined;
  alt: string;
  className?: string;
}) {
  const needsSigning = !!url && !isRemote(url);
  const { data: signed } = useQuery({
    queryKey: ["signed-url", url],
    queryFn: () => getSignedUrl(url!),
    enabled: needsSigning,
    staleTime: 50 * 60 * 1000,
  });

  const src = url ? (isRemote(url) ? url : (signed ?? null)) : null;

  return (
    <div
      className={cn("relative h-36 w-full overflow-hidden sm:h-52 lg:h-64", className)}
      style={src ? undefined : { backgroundImage: "var(--gradient-brand)" }}
    >
      {src ? <img src={src} alt={alt} className="size-full object-cover" /> : null}
      <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-background/80 to-transparent" />
    </div>
  );
}
