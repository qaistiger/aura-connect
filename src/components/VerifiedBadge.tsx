import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function VerifiedBadge({ className }: { className?: string }) {
  return (
    <BadgeCheck
      aria-label="Verified account"
      className={cn("size-4 shrink-0 fill-primary text-primary-foreground", className)}
    />
  );
}
