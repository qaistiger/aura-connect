import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrlFrom } from "@/lib/media";

export const BRANDING_BUCKET = "branding";

export type Branding = {
  site_name: string;
  tagline: string;
  logo_path: string | null;
};

export const DEFAULT_BRANDING: Branding = {
  site_name: "AURALIS",
  tagline: "Your world, your feed",
  logo_path: null,
};

export function useBranding() {
  const { data } = useQuery({
    queryKey: ["branding"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Branding> => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "branding")
        .maybeSingle();
      if (error) throw error;
      const raw = (data?.value ?? {}) as Partial<Branding>;
      return {
        site_name: raw.site_name?.trim() || DEFAULT_BRANDING.site_name,
        tagline: raw.tagline?.trim() || DEFAULT_BRANDING.tagline,
        logo_path: raw.logo_path ?? null,
      };
    },
  });
  return data ?? DEFAULT_BRANDING;
}

export function useBrandingLogoUrl(path: string | null | undefined) {
  const { data } = useQuery({
    queryKey: ["branding-logo", path],
    enabled: !!path,
    staleTime: 50 * 60 * 1000,
    queryFn: () => getSignedUrlFrom(BRANDING_BUCKET, path!),
  });
  return path ? (data ?? null) : null;
}
