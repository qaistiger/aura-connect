import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ImagePlus, Link2, Loader2, ShieldCheck, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { MEDIA_BUCKET, MAX_PHOTO_BYTES } from "@/lib/media";
import { UserAvatar } from "@/components/UserAvatar";
import { CoverBanner } from "@/components/CoverBanner";
import { ImageCropper } from "@/components/ImageCropper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Account settings — ZYNORAIO" },
      {
        name: "description",
        content:
          "Update your ZYNORAIO username, display name, bio, photos, connected accounts and security options.",
      },
      { property: "og:title", content: "Account settings — ZYNORAIO" },
      { property: "og:description", content: "Manage your ZYNORAIO profile and security." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

const USERNAME_RE = /^[a-z0-9_]{3,24}$/;
type PhotoKind = "avatar" | "cover";

function SettingsPage() {
  const { user, profile, signOut } = useAuth();
  const queryClient = useQueryClient();

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [youtube, setYoutube] = useState("");
  const [instagram, setInstagram] = useState("");
  const [facebook, setFacebook] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [cropping, setCropping] = useState<{ file: File; kind: PhotoKind } | null>(null);

  useEffect(() => {
    if (profile) {
      setUsername(profile.username);
      setDisplayName(profile.display_name);
      setBio(profile.bio);
      const p = profile as unknown as Record<string, string | null>;
      setYoutube(p['youtube_url'] ?? "");
      setInstagram(p['instagram_url'] ?? "");
      setFacebook(p['facebook_url'] ?? "");
      setWhatsapp(p['whatsapp_number'] ?? "");
    }
  }, [profile]);

  const normalized = username.trim().toLowerCase();
  const formatValid = USERNAME_RE.test(normalized);
  const unchanged = normalized === profile?.username;

  const { data: available, isFetching: checking } = useQuery({
    queryKey: ["username-available", normalized],
    enabled: formatValid && !unchanged,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .ilike("username", normalized)
        .maybeSingle();
      if (error) throw error;
      return !data;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("auth");
      if (!formatValid) throw new Error("format");
      const { error } = await supabase
        .from("profiles")
        .update({
          username: normalized,
          display_name: displayName.trim().slice(0, 60),
          bio: bio.trim().slice(0, 300),
          youtube_url: youtube.trim().slice(0, 200) || null,
          instagram_url: instagram.trim().slice(0, 200) || null,
          facebook_url: facebook.trim().slice(0, 200) || null,
          whatsapp_number: whatsapp.trim().slice(0, 25) || null,
        })
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profile updated");
      queryClient.invalidateQueries();
    },
    onError: (e: unknown) => {
      const message = String((e as { message?: string })?.message ?? "");
      if (message.includes("duplicate") || message.includes("profiles_username_key")) {
        toast.error("That username is already taken");
      } else if (message === "format") {
        toast.error("Usernames use 3–24 lowercase letters, numbers or underscores");
      } else {
        toast.error("We couldn't save your changes");
      }
    },
  });

  const pickPhoto = (file: File | undefined, kind: PhotoKind) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      toast.error("Images must be 10 MB or smaller");
      return;
    }
    setCropping({ file, kind });
  };

  const uploadCropped = async (blob: Blob, kind: PhotoKind) => {
    if (!user) return;
    setPhotoBusy(true);
    try {
      const path = `${user.id}/${kind}-${crypto.randomUUID()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from(MEDIA_BUCKET)
        .upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (upErr) throw upErr;
      const { error } = await supabase
        .from("profiles")
        .update(kind === "avatar" ? { avatar_url: path } : { cover_url: path })
        .eq("id", user.id);
      if (error) throw error;
      await supabase
        .from("profile_media_history")
        .insert({ user_id: user.id, kind, url: path });
      toast.success(kind === "avatar" ? "Profile photo updated" : "Cover photo updated");
      queryClient.invalidateQueries();
    } catch {
      toast.error("We couldn't update your photo");
    } finally {
      setPhotoBusy(false);
      setCropping(null);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your identity, privacy and security.</p>
      </div>

      <section className="glass-panel overflow-hidden rounded-2xl">
        <div className="relative">
          <CoverBanner
            url={(profile as unknown as { cover_url?: string | null })?.cover_url}
            alt="Your cover photo"
          />
          <label className="absolute right-3 bottom-3 cursor-pointer">
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                pickPhoto(e.target.files?.[0], "cover");
                e.target.value = "";
              }}
            />
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-background/80 px-3 py-2 text-sm font-medium backdrop-blur hover:bg-secondary">
              <ImagePlus className="size-4" /> {photoBusy ? "Uploading…" : "Edit cover"}
            </span>
          </label>
        </div>

        <div className="space-y-5 p-6">
          <div className="flex items-center gap-4">
            <UserAvatar
              url={profile?.avatar_url}
              name={profile?.display_name || profile?.username || "Me"}
              className="-mt-14 size-20 border-4 border-background"
            />
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  pickPhoto(e.target.files?.[0], "avatar");
                  e.target.value = "";
                }}
              />
              <span className="inline-flex items-center rounded-lg border border-input px-3 py-2 text-sm font-medium hover:bg-secondary">
                {photoBusy ? "Uploading…" : "Change photo"}
              </span>
            </label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              maxLength={24}
            />
            <p className="flex items-center gap-1.5 text-xs">
              {!formatValid ? (
                <span className="text-muted-foreground">
                  3–24 lowercase letters, numbers or underscores.
                </span>
              ) : unchanged ? (
                <span className="text-muted-foreground">This is your current username.</span>
              ) : checking ? (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" /> Checking availability…
                </span>
              ) : available ? (
                <span className="flex items-center gap-1 text-success">
                  <Check className="size-3" /> @{normalized} is available
                </span>
              ) : (
                <span className="flex items-center gap-1 text-destructive">
                  <X className="size-3" /> @{normalized} is already taken
                </span>
              )}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="display-name">Display name</Label>
            <Input
              id="display-name"
              value={displayName}
              maxLength={60}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea id="bio" value={bio} maxLength={300} onChange={(e) => setBio(e.target.value)} />
          </div>

          <Separator />

          <div className="space-y-4">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold">
              <Link2 className="size-5 text-primary" /> Connected accounts
            </h2>
            <p className="text-xs text-muted-foreground">
              Only the accounts you fill in appear on your profile — empty ones stay hidden.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="youtube">YouTube</Label>
                <Input
                  id="youtube"
                  value={youtube}
                  maxLength={200}
                  placeholder="youtube.com/@you"
                  onChange={(e) => setYoutube(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="instagram">Instagram</Label>
                <Input
                  id="instagram"
                  value={instagram}
                  maxLength={200}
                  placeholder="instagram.com/you"
                  onChange={(e) => setInstagram(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="facebook">Facebook</Label>
                <Input
                  id="facebook"
                  value={facebook}
                  maxLength={200}
                  placeholder="facebook.com/you"
                  onChange={(e) => setFacebook(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="whatsapp">WhatsApp number</Label>
                <Input
                  id="whatsapp"
                  value={whatsapp}
                  maxLength={25}
                  placeholder="+92 300 1234567"
                  onChange={(e) => setWhatsapp(e.target.value)}
                />
              </div>
            </div>
          </div>

          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || !formatValid || (!unchanged && available === false)}
          >
            {save.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </section>

      <section className="glass-panel space-y-4 rounded-2xl p-6">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold">
          <ShieldCheck className="size-5 text-primary" /> Security
        </h2>
        <p className="text-sm text-muted-foreground">
          Your account is protected by your identity provider (Google or Apple). Passwords and two-factor
          settings are managed there, so ZYNORAIO never stores a password for you.
        </p>
        <Separator />
        <div className="space-y-1 text-sm">
          <p>
            <span className="text-muted-foreground">Signed in as</span> {user?.email}
          </p>
          <p className="text-muted-foreground">
            Private posts are stored in a protected area and are only accessible to you — and to our
            moderation team when a legal or safety review is required.
          </p>
        </div>
        <Button variant="outline" onClick={() => signOut()}>
          Sign out of this device
        </Button>
      </section>

      <ImageCropper
        file={cropping?.file ?? null}
        aspect={cropping?.kind === "cover" ? 16 / 6 : 1}
        title={cropping?.kind === "cover" ? "Edit cover photo" : "Edit profile photo"}
        outputWidth={cropping?.kind === "cover" ? 1600 : 640}
        onCancel={() => setCropping(null)}
        onCropped={(blob) => uploadCropped(blob, cropping?.kind ?? "avatar")}
      />
    </div>
  );
}
