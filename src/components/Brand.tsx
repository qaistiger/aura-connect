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
        className={cn("h-9 w-auto max-w-[160px] shrink-0 object-contain", className)}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-base font-black tracking-tight text-primary-foreground",
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
  size?: "md" | "lg" | "xl";
}) {
  const branding = useBranding();
  const logo = useBrandingLogoUrl(branding.logo_path);

  const mark =
    size === "xl"
      ? "h-20 max-w-[320px] size-auto min-h-20 min-w-20 rounded-3xl text-4xl"
      : size === "lg"
        ? "h-14 max-w-[240px] size-auto min-h-14 min-w-14 rounded-2xl text-2xl"
        : "";
  const text =
    size === "xl" ? "text-4xl" : size === "lg" ? "text-2xl" : "text-lg";

  return (
    <span className={cn("flex items-center gap-3", className)}>
      <BrandMark className={mark} />
      {logo ? null : (
        <span className={cn("font-display font-extrabold tracking-tight", text)}>
          <span className="brand-text">{branding.site_name.toUpperCase()}</span>
        </span>
      )}
    </span>
  );
}
