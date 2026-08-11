import { Facebook, Instagram, MessageCircle, Youtube } from "lucide-react";
import { Button } from "@/components/ui/button";

export type SocialLinksValue = {
  youtube_url?: string | null;
  instagram_url?: string | null;
  facebook_url?: string | null;
  whatsapp_number?: string | null;
};

function safeUrl(raw: string | null | undefined) {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withProtocol);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function whatsappLink(raw: string | null | undefined) {
  if (!raw) return null;
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  return `https://wa.me/${digits}`;
}

export function SocialLinks({ value }: { value: SocialLinksValue }) {
  const items = [
    { key: "youtube", href: safeUrl(value.youtube_url), icon: Youtube, label: "YouTube" },
    { key: "instagram", href: safeUrl(value.instagram_url), icon: Instagram, label: "Instagram" },
    { key: "facebook", href: safeUrl(value.facebook_url), icon: Facebook, label: "Facebook" },
    { key: "whatsapp", href: whatsappLink(value.whatsapp_number), icon: MessageCircle, label: "WhatsApp" },
  ].filter((item) => !!item.href);

  if (items.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {items.map((item) => (
        <Button key={item.key} asChild variant="outline" size="sm" className="gap-1.5">
          <a href={item.href!} target="_blank" rel="noopener noreferrer nofollow">
            <item.icon className="size-4" />
            {item.label}
          </a>
        </Button>
      ))}
    </div>
  );
}
