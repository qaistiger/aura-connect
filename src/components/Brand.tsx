import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-base font-black tracking-tight text-primary-foreground",
        className,
      )}
      style={{ backgroundImage: "var(--gradient-brand)" }}
    >
      A
    </span>
  );
}

export function BrandLockup({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <BrandMark />
      <span className="font-display text-lg font-extrabold tracking-tight">
        <span className="brand-text">AURALIS</span>
      </span>
    </span>
  );
}
