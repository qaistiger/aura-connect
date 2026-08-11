import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { BRANDING_BUCKET } from "@/lib/branding";
import { getSignedUrlFrom } from "@/lib/media";
import { cn } from "@/lib/utils";

export type LoginPhoto = {
  id: string;
  image_url: string;
  caption: string;
  sort_order: number;
  is_active: boolean;
};

export function useLoginPhotos() {
  return useQuery({
    queryKey: ["login-photos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("login_photos")
        .select("id,image_url,caption,sort_order,is_active")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as LoginPhoto[];
    },
  });
}

function useSignedPhotos(photos: LoginPhoto[]) {
  const key = photos.map((p) => p.image_url).join("|");
  return useQuery({
    queryKey: ["login-photo-urls", key],
    enabled: photos.length > 0,
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      const urls = await Promise.all(
        photos.map(async (p) => ({
          id: p.id,
          caption: p.caption,
          url: p.image_url.startsWith("http")
            ? p.image_url
            : await getSignedUrlFrom(BRANDING_BUCKET, p.image_url),
        })),
      );
      return urls.filter((u): u is { id: string; caption: string; url: string } => !!u.url);
    },
  });
}

export function LoginShowcase({ className }: { className?: string }) {
  const { data: photos = [] } = useLoginPhotos();
  const active = photos.filter((p) => p.is_active);
  const { data: slides = [] } = useSignedPhotos(active);

  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);

  const go = useCallback(
    (next: number) => {
      if (slides.length === 0) return;
      setIndex(((next % slides.length) + slides.length) % slides.length);
    },
    [slides.length],
  );

  useEffect(() => {
    if (slides.length < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % slides.length), 5000);
    return () => clearInterval(t);
  }, [slides.length]);

  if (slides.length === 0) return null;

  return (
    <div
      className={cn("glass-panel overflow-hidden rounded-2xl", className)}
      onTouchStart={(e) => {
        touchX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const start = touchX.current;
        const end = e.changedTouches[0]?.clientX ?? null;
        if (start === null || end === null) return;
        const delta = end - start;
        if (Math.abs(delta) > 40) go(index + (delta < 0 ? 1 : -1));
        touchX.current = null;
      }}
    >
      <div className="relative aspect-16/10 w-full overflow-hidden">
        {slides.map((s, i) => (
          <img
            key={s.id}
            src={s.url}
            alt={s.caption || "Showcase photo"}
            loading={i === 0 ? "eager" : "lazy"}
            className={cn(
              "absolute inset-0 size-full object-cover transition-opacity duration-700 ease-out",
              i === index ? "opacity-100" : "opacity-0",
            )}
          />
        ))}
        {slides[index]?.caption ? (
          <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/90 to-transparent p-4 text-sm font-medium">
            {slides[index]?.caption}
          </p>
        ) : null}
      </div>

      {slides.length > 1 ? (
        <div className="flex justify-center gap-2 py-3">
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              aria-label={`Go to photo ${i + 1}`}
              onClick={() => go(i)}
              className={cn(
                "h-2 rounded-full transition-all",
                i === index ? "w-6 bg-primary" : "w-2 bg-muted-foreground/40 hover:bg-muted-foreground",
              )}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
