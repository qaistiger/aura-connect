import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getSignedUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

function isRemote(url: string) {
  return url.startsWith("http://") || url.startsWith("https://");
}

export function UserAvatar({
  url,
  name,
  className,
}: {
  url: string | null | undefined;
  name: string;
  className?: string;
}) {
  const needsSigning = !!url && !isRemote(url);
  const { data: signed } = useQuery({
    queryKey: ["signed-url", url],
    queryFn: () => getSignedUrl(url!),
    enabled: needsSigning,
    staleTime: 50 * 60 * 1000,
  });

  const src = url ? (isRemote(url) ? url : (signed ?? undefined)) : undefined;

  return (
    <Avatar className={cn("size-10 border border-border", className)}>
      {src ? <AvatarImage src={src} alt={name} /> : null}
      <AvatarFallback className="bg-secondary text-xs font-semibold uppercase">
        {name.slice(0, 2)}
      </AvatarFallback>
    </Avatar>
  );
}
