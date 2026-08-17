import { cn } from "@/lib/utils";
import { useBranding, useBrandingLogoUrl } from "@/lib/branding";

export function BrandMark({ className }: { className?: string }) {
  const branding = useBranding();
  const logo = useBrandingLogoUrl(branding.logo_path);

  if (logo) {
    return (
      <img
        src={logo}
        alt={`${branding.site_name} logo`}
        className={cn("h-8 w-auto max-w-[120px] shrink-0 object-contain", className)}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-black tracking-tight text-primary-foreground",
        className,
      )}
      style={{ backgroundImage: "var(--gradient-brand)" }}
    >
      {branding.site_name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function BrandLockup({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const branding = useBranding();
  const logo = useBrandingLogoUrl(branding.logo_path);

  const mark =
    size === "xl"
      ? "h-16 max-w-[260px] size-auto min-h-16 min-w-16 rounded-2xl text-3xl"
      : size === "lg"
        ? "h-10 max-w-[160px] size-auto min-h-10 min-w-10 rounded-xl text-xl"
        : size === "sm"
          ? logo
            ? "h-7 w-auto max-w-[96px]"
            : "size-7 rounded-md text-sm"
          : "";
  const text =
    size === "xl"
      ? "text-3xl"
      : size === "lg"
        ? "text-xl"
        : size === "sm"
          ? "text-base sm:text-lg"
          : "text-base";

  return (
    <span className={cn("flex min-w-0 items-center gap-2", className)}>
      <BrandMark className={mark} />
      <span
        className={cn(
          "truncate font-display font-extrabold tracking-tight",
          text,
        )}
      >
        <span className="brand-text">{branding.site_name.toUpperCase()}</span>
      </span>
    </span>
  );
}
