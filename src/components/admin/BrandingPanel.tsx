import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ImagePlus, Loader2, Trash2, Upload } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { BRANDING_BUCKET, useBranding, useBrandingLogoUrl } from "@/lib/branding";
import { getSignedUrlFrom } from "@/lib/media";
import { useLoginPhotos, type LoginPhoto } from "@/components/LoginShowcase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/avif"];
const MAX_BYTES = 8 * 1024 * 1024;

function validateImage(file: File) {
  if (!IMAGE_TYPES.includes(file.type)) return "Use a PNG, JPG, WEBP, AVIF or SVG image.";
  if (file.size > MAX_BYTES) return "Images must be 8 MB or smaller.";
  return null;
}

async function uploadBranding(prefix: string, file: File) {
  const ext = (file.name.split(".").pop() ?? "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  const path = `${prefix}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(BRANDING_BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
  if (error) throw error;
  return path;
}

export function BrandingPanel() {
  const branding = useBranding();
  const logoUrl = useBrandingLogoUrl(branding.logo_path);
  const queryClient = useQueryClient();
  const logoInput = useRef<HTMLInputElement>(null);

  const [siteName, setSiteName] = useState(branding.site_name);
  const [tagline, setTagline] = useState(branding.tagline);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSiteName(branding.site_name);
    setTagline(branding.tagline);
  }, [branding.site_name, branding.tagline]);

  const saveBranding = useMutation({
    mutationFn: async (next: { site_name?: string; tagline?: string; logo_path?: string | null }) => {
      const value = {
        site_name: (next.site_name ?? siteName).trim() || "AURALIS",
        tagline: (next.tagline ?? tagline).trim(),
        logo_path: next.logo_path === undefined ? branding.logo_path : next.logo_path,
      };
      const { error } = await supabase
        .from("platform_settings")
        .upsert({ key: "branding", value, updated_at: new Date().toISOString() }, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branding"] });
      toast.success("Branding updated");
    },
    onError: () => toast.error("Couldn't save branding. Super admin access is required."),
  });

  const onLogoPick = async (file: File | undefined) => {
    if (!file) return;
    const problem = validateImage(file);
    if (problem) {
      toast.error(problem);
      return;
    }
    setBusy(true);
    try {
      const path = await uploadBranding("logo", file);
      await saveBranding.mutateAsync({ logo_path: path });
    } catch {
      toast.error("Logo upload failed.");
    } finally {
      setBusy(false);
      if (logoInput.current) logoInput.current.value = "";
    }
  };

  return (
    <div className="space-y-5">
      <section className="glass-panel rounded-2xl p-5">
        <h3 className="font-display text-base font-bold">Website name & logo</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          The name and logo appear in the header, sign-in page and browser tab.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="site-name">Website name</Label>
            <Input
              id="site-name"
              value={siteName}
              maxLength={40}
              onChange={(e) => setSiteName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tagline">Tagline</Label>
            <Input
              id="tagline"
              value={tagline}
              maxLength={80}
              onChange={(e) => setTagline(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div className="flex h-14 min-w-14 items-center justify-center">
            {logoUrl ? (
              <img src={logoUrl} alt="Current logo" className="h-12 w-auto max-w-40 object-contain" />
            ) : (
              <span className="text-xs text-muted-foreground">No logo uploaded</span>
            )}
          </div>
          <input
            ref={logoInput}
            type="file"
            accept={IMAGE_TYPES.join(",")}
            className="hidden"
            onChange={(e) => void onLogoPick(e.target.files?.[0])}
          />
          <Button variant="outline" onClick={() => logoInput.current?.click()} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {branding.logo_path ? "Replace logo" : "Upload logo"}
          </Button>
          {branding.logo_path ? (
            <Button
              variant="ghost"
              onClick={() => saveBranding.mutate({ logo_path: null })}
              disabled={busy}
            >
              <Trash2 className="size-4" /> Remove logo
            </Button>
          ) : null}
          <Button
            className="ml-auto"
            onClick={() => saveBranding.mutate({})}
            disabled={saveBranding.isPending}
          >
            Save changes
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Transparent PNG or SVG recommended — the logo renders exactly as uploaded, with no frame or
          background.
        </p>
      </section>

      <LoginPhotosPanel />
    </div>
  );
}

function LoginPhotosPanel() {
  const { data: photos = [], isLoading } = useLoginPhotos();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["login-photos"] });

  const addPhotos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      let order = photos.length;
      for (const file of Array.from(files)) {
        const problem = validateImage(file);
        if (problem) {
          toast.error(problem);
          continue;
        }
        const path = await uploadBranding("login", file);
        const { error } = await supabase
          .from("login_photos")
          .insert({ image_url: path, sort_order: order++ });
        if (error) throw error;
      }
      refresh();
      toast.success("Photos added to the sign-in showcase");
    } catch {
      toast.error("Upload failed. Only admins can manage these photos.");
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<LoginPhoto> }) => {
      const { error } = await supabase.from("login_photos").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: () => toast.error("Couldn't update photo."),
  });

  const remove = useMutation({
    mutationFn: async (photo: LoginPhoto) => {
      const { error } = await supabase.from("login_photos").delete().eq("id", photo.id);
      if (error) throw error;
      if (!photo.image_url.startsWith("http")) {
        await supabase.storage.from(BRANDING_BUCKET).remove([photo.image_url]);
      }
    },
    onSuccess: () => {
      refresh();
      toast.success("Photo removed");
    },
    onError: () => toast.error("Couldn't remove photo."),
  });

  return (
    <section className="glass-panel rounded-2xl p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h3 className="font-display text-base font-bold">Sign-in photo showcase</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Admin-only slider shown on the login page. Auto-plays, swipeable, with navigation dots.
          </p>
        </div>
        <input
          ref={fileInput}
          type="file"
          multiple
          accept={IMAGE_TYPES.join(",")}
          className="hidden"
          onChange={(e) => void addPhotos(e.target.files)}
        />
        <Button className="ml-auto" onClick={() => fileInput.current?.click()} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
          Add photos
        </Button>
      </div>

      <Separator className="my-4" />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading photos…</p>
      ) : photos.length === 0 ? (
        <p className="text-sm text-muted-foreground">No showcase photos yet.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {photos.map((photo) => (
            <PhotoRow
              key={photo.id}
              photo={photo}
              onCaption={(caption) => update.mutate({ id: photo.id, patch: { caption } })}
              onToggle={(is_active) => update.mutate({ id: photo.id, patch: { is_active } })}
              onOrder={(sort_order) => update.mutate({ id: photo.id, patch: { sort_order } })}
              onRemove={() => remove.mutate(photo)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function PhotoRow({
  photo,
  onCaption,
  onToggle,
  onOrder,
  onRemove,
}: {
  photo: LoginPhoto;
  onCaption: (v: string) => void;
  onToggle: (v: boolean) => void;
  onOrder: (v: number) => void;
  onRemove: () => void;
}) {
  const [caption, setCaption] = useState(photo.caption);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (photo.image_url.startsWith("http")) {
      setUrl(photo.image_url);
    } else {
      void getSignedUrlFrom(BRANDING_BUCKET, photo.image_url).then((u) => {
        if (!cancelled) setUrl(u);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [photo.image_url]);

  return (
    <li className="flex gap-3 rounded-xl border border-border p-3">
      <div className="size-20 shrink-0 overflow-hidden rounded-lg bg-muted">
        {url ? <img src={url} alt={photo.caption || "Showcase photo"} className="size-full object-cover" /> : null}
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <Input
          value={caption}
          maxLength={80}
          placeholder="Caption (optional)"
          onChange={(e) => setCaption(e.target.value)}
          onBlur={() => caption !== photo.caption && onCaption(caption)}
        />
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch checked={photo.is_active} onCheckedChange={onToggle} />
            Visible
          </label>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Order
            <Input
              type="number"
              className="h-8 w-16"
              defaultValue={photo.sort_order}
              onBlur={(e) => {
                const v = Number(e.target.value);
                if (!Number.isNaN(v) && v !== photo.sort_order) onOrder(v);
              }}
            />
          </label>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={onRemove}>
            <Trash2 className="size-4" /> Remove
          </Button>
        </div>
      </div>
    </li>
  );
}
