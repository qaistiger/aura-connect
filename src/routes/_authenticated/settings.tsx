import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Loader2, ShieldCheck, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { buildMediaPath, validateMedia } from "@/lib/media";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Account settings — AURALIS" },
      { name: "description", content: "Update your AURALIS username, display name, bio, avatar and security options." },
      { property: "og:title", content: "Account settings — AURALIS" },
      { property: "og:description", content: "Manage your AURALIS profile and security." },
    ],
  }),
  component: SettingsPage,
});

const USERNAME_RE = /^[a-z0-9_]{3,24}$/;

function SettingsPage() {
  const { user, profile, signOut } = useAuth();
  const queryClient = useQueryClient();

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarBusy, setAvatarBusy] = useState(false);

  useEffect(() => {
    if (profile) {
      setUsername(profile.username);
      setDisplayName(profile.display_name);
      setBio(profile.bio);
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

  const changeAvatar = async (file: File | undefined) => {
    if (!file || !user) return;
    const result = validateMedia(file);
    if (!result.ok || result.kind !== "photo") {
      toast.error("Choose an image up to 10 MB");
      return;
    }
    setAvatarBusy(true);
    try {
      const path = buildMediaPath(user.id, file);
      const { error: upErr } = await supabase.storage
        .from("media")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const { error } = await supabase.from("profiles").update({ avatar_url: path }).eq("id", user.id);
      if (error) throw error;
      toast.success("Profile photo updated");
      queryClient.invalidateQueries();
    } catch {
      toast.error("We couldn't update your photo");
    } finally {
      setAvatarBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your identity, privacy and security.</p>
      </div>

      <section className="glass-panel space-y-5 rounded-2xl p-6">
        <h2 className="font-display text-lg font-bold">Profile</h2>

        <div className="flex items-center gap-4">
          <UserAvatar
            url={profile?.avatar_url}
            name={profile?.display_name || profile?.username || "Me"}
            className="size-16"
          />
          <label className="cursor-pointer">
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => changeAvatar(e.target.files?.[0])}
            />
            <span className="inline-flex items-center rounded-lg border border-input px-3 py-2 text-sm font-medium hover:bg-secondary">
              {avatarBusy ? "Uploading…" : "Change photo"}
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
              <span className="text-muted-foreground">3–24 lowercase letters, numbers or underscores.</span>
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

        <Button
          onClick={() => save.mutate()}
          disabled={save.isPending || !formatValid || (!unchanged && available === false)}
        >
          {save.isPending ? "Saving…" : "Save changes"}
        </Button>
      </section>

      <section className="glass-panel space-y-4 rounded-2xl p-6">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold">
          <ShieldCheck className="size-5 text-primary" /> Security
        </h2>
        <p className="text-sm text-muted-foreground">
          Your account is protected by your identity provider (Google or Apple). Passwords and two-factor
          settings are managed there, so AURALIS never stores a password for you.
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
    </div>
  );
}
