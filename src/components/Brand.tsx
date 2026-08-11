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

export function BrandLockup({ className }: { className?: string }) {
  const branding = useBranding();
  const logo = useBrandingLogoUrl(branding.logo_path);

  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <BrandMark />
      {logo ? null : (
        <span className="font-display text-lg font-extrabold tracking-tight">
          <span className="brand-text">{branding.site_name.toUpperCase()}</span>
        </span>
      )}
    </span>
  );
}
