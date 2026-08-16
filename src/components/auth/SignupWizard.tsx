import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  ImagePlus,
  Loader2,
  MapPin,
  ShieldCheck,
  X,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { MAX_PHOTO_BYTES, MEDIA_BUCKET } from "@/lib/media";
import { USERNAME_RE, usernameToEmail } from "@/lib/username-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

const STEPS = ["Credentials", "Profile", "Location", "Confirm"] as const;

type Props = { onDone: () => void; onCancel: () => void };

export function SignupWizard({ onDone, onCancel }: Props) {
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);

  // Step 1
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Step 2
  const [avatar, setAvatar] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);

  // Step 3
  const [locationLabel, setLocationLabel] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);

  // Step 4
  const [consent, setConsent] = useState(false);

  const normalized = username.trim().toLowerCase();
  const formatValid = USERNAME_RE.test(normalized);

  const { data: available, isFetching: checking } = useQuery({
    queryKey: ["username-available", normalized],
    enabled: formatValid && !userId,
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

  const nameOk = fullName.trim().length >= 2;
  const passwordOk = password.length >= 8 && password === confirm;
  const usernameOk = formatValid && available === true;

  const createAccount = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: usernameToEmail(normalized),
        password,
      });
      if (error) throw error;
      const id = data.user?.id ?? null;
      if (!id) throw new Error("We couldn't create your account. Please try again.");
      setUserId(id);
      await supabase
        .from("profiles")
        .update({ username: normalized, display_name: fullName.trim() })
        .eq("id", id);
      setStep(1);
    } catch (error) {
      toast.error("Sign-up failed", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setBusy(false);
    }
  };

  const uploadPhoto = async (file: File, kind: "avatar" | "cover") => {
    if (!userId) return null;
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${userId}/${kind}-${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from(MEDIA_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;
    return path;
  };

  const savePhotos = async () => {
    if (!userId) return;
    setBusy(true);
    try {
      const patch: { avatar_url?: string; cover_url?: string } = {};
      if (avatar) patch.avatar_url = (await uploadPhoto(avatar, "avatar")) ?? "";
      if (cover) patch.cover_url = (await uploadPhoto(cover, "cover")) ?? "";
      if (Object.keys(patch).length > 0) {
        const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
        if (error) throw error;
      }
      setStep(2);
    } catch {
      toast.error("We couldn't upload your photos", { description: "You can add them later in settings." });
    } finally {
      setBusy(false);
    }
  };

  const detectLocation = () => {
    if (!("geolocation" in navigator)) {
      toast.error("Location isn't available on this device");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationLabel(
          (v) => v || `${pos.coords.latitude.toFixed(3)}, ${pos.coords.longitude.toFixed(3)}`,
        );
        setLocating(false);
        toast.success("Location saved privately");
      },
      () => {
        setLocating(false);
        toast.error("Location permission denied", { description: "You can type your location instead." });
      },
      { enableHighAccuracy: false, timeout: 10000 },
    );
  };

  const finish = async () => {
    if (!userId) return;
    setBusy(true);
    try {
      if (locationLabel.trim() || coords) {
        await supabase.from("profile_locations").upsert({
          user_id: userId,
          label: locationLabel.trim().slice(0, 120),
          latitude: coords?.lat ?? null,
          longitude: coords?.lng ?? null,
          share_consent: true,
        });
      }
      const { error } = await supabase
        .from("profiles")
        .update({ setup_complete: true })
        .eq("id", userId);
      if (error) throw error;
      toast.success("Welcome to ZYNORAIO!");
      onDone();
    } catch {
      toast.error("We couldn't finish setting up your account");
    } finally {
      setBusy(false);
    }
  };

  const pick = (file: File | undefined, set: (f: File) => void) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      toast.error("Images must be 10 MB or smaller");
      return;
    }
    set(file);
  };

  return (
    <div>
      <div className="mb-6 flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex flex-1 flex-col gap-1.5">
            <span
              className={cn(
                "h-1.5 rounded-full transition-colors",
                i <= step ? "bg-primary" : "bg-muted",
              )}
            />
            <span
              className={cn(
                "text-[10px] font-semibold tracking-wide uppercase",
                i === step ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {label}
            </span>
          </div>
        ))}
      </div>

      {step === 0 ? (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (nameOk && usernameOk && passwordOk) void createAccount();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="su-name">Your name</Label>
            <Input
              id="su-name"
              value={fullName}
              maxLength={60}
              autoComplete="name"
              placeholder="Alex Rivera"
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="su-username">Username</Label>
            <Input
              id="su-username"
              value={username}
              maxLength={24}
              autoComplete="username"
              placeholder="alexrivera"
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
            />
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {!formatValid ? (
                "3–24 characters — lowercase letters, numbers and underscores."
              ) : checking ? (
                <>
                  <Loader2 className="size-3 animate-spin" /> Checking availability…
                </>
              ) : available ? (
                <>
                  <Check className="size-3 text-primary" /> @{normalized} is available
                </>
              ) : (
                <>
                  <X className="size-3 text-destructive" /> That username is taken
                </>
              )}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="su-password">Password</Label>
            <div className="relative">
              <Input
                id="su-password"
                type={show ? "text" : "password"}
                value={password}
                autoComplete="new-password"
                placeholder="At least 8 characters"
                className="pr-10"
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
              >
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="su-confirm">Confirm password</Label>
            <Input
              id="su-confirm"
              type={show ? "text" : "password"}
              value={confirm}
              autoComplete="new-password"
              placeholder="Repeat password"
              onChange={(e) => setConfirm(e.target.value)}
            />
            {confirm.length > 0 && password !== confirm ? (
              <p className="text-xs text-destructive">Passwords don't match.</p>
            ) : null}
          </div>
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={!nameOk || !usernameOk || !passwordOk || busy}
          >
            {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Continue
          </Button>
          <button
            type="button"
            className="w-full text-center text-xs font-semibold text-muted-foreground hover:text-foreground"
            onClick={onCancel}
          >
            Back to sign in
          </button>
        </form>
      ) : null}

      {step === 1 ? (
        <div className="space-y-5">
          <div>
            <h2 className="font-display text-lg font-bold">Make it yours</h2>
            <p className="text-sm text-muted-foreground">
              Add a profile photo and a cover thumbnail. You can change these any time.
            </p>
          </div>

          <PhotoPicker
            label="Profile photo"
            file={avatar}
            round
            onPick={(f) => pick(f, setAvatar)}
            onClear={() => setAvatar(null)}
          />
          <PhotoPicker
            label="Cover / art thumbnail"
            file={cover}
            onPick={(f) => pick(f, setCover)}
            onClear={() => setCover(null)}
          />

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setStep(2)} disabled={busy}>
              Skip
            </Button>
            <Button className="flex-1" onClick={() => void savePhotos()} disabled={busy}>
              {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Continue
            </Button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-5">
          <div>
            <h2 className="flex items-center gap-2 font-display text-lg font-bold">
              <MapPin className="size-5 text-primary" /> Your location
            </h2>
            <p className="text-sm text-muted-foreground">
              Share your location to improve nearby recommendations and account safety.
            </p>
          </div>

          <div className="rounded-xl border border-border/70 bg-muted/30 p-4 text-xs text-muted-foreground">
            Your location is private. Only you and the ZYNORAIO admin team can see it — it is never shown
            on your profile, posts or search results. You can edit or remove it at any time in Settings.
          </div>

          <Button variant="outline" className="w-full" onClick={detectLocation} disabled={locating}>
            {locating ? <Loader2 className="mr-2 size-4 animate-spin" /> : <MapPin className="mr-2 size-4" />}
            {coords ? "Update detected location" : "Allow location access"}
          </Button>

          <div className="space-y-2">
            <Label htmlFor="su-location">Or set it manually</Label>
            <Input
              id="su-location"
              value={locationLabel}
              maxLength={120}
              placeholder="Lahore, Pakistan"
              onChange={(e) => setLocationLabel(e.target.value)}
            />
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
              <ArrowLeft className="mr-2 size-4" /> Back
            </Button>
            <Button className="flex-1" onClick={() => setStep(3)}>
              Continue
            </Button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-5">
          <div>
            <h2 className="flex items-center gap-2 font-display text-lg font-bold">
              <ShieldCheck className="size-5 text-primary" /> Review and activate
            </h2>
            <p className="text-sm text-muted-foreground">One last check before your account goes live.</p>
          </div>

          <dl className="space-y-2 rounded-xl border border-border/70 p-4 text-sm">
            <Row label="Name" value={fullName.trim()} />
            <Row label="Username" value={`@${normalized}`} />
            <Row label="Profile photo" value={avatar ? "Added" : "Skipped"} />
            <Row label="Cover image" value={cover ? "Added" : "Skipped"} />
            <Row label="Location" value={locationLabel.trim() || "Not set"} />
          </dl>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/70 p-4 text-sm">
            <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
            <span className="text-muted-foreground">
              I agree to the ZYNORAIO community rules, confirm the details above are mine, and consent to
              my private location being used only for safety and personalisation.
            </span>
          </label>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>
              <ArrowLeft className="mr-2 size-4" /> Back
            </Button>
            <Button className="flex-1" onClick={() => void finish()} disabled={!consent || busy}>
              {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Activate account
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium">{value}</dd>
    </div>
  );
}

function PhotoPicker({
  label,
  file,
  round,
  onPick,
  onClear,
}: {
  label: string;
  file: File | null;
  round?: boolean;
  onPick: (file: File | undefined) => void;
  onClear: () => void;
}) {
  const url = file ? URL.createObjectURL(file) : null;
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-4">
        <div
          className={cn(
            "flex shrink-0 items-center justify-center overflow-hidden border border-border/70 bg-muted/40",
            round ? "size-16 rounded-full" : "h-16 w-28 rounded-lg",
          )}
        >
          {url ? (
            <img src={url} alt={label} className="size-full object-cover" />
          ) : (
            <ImagePlus className="size-5 text-muted-foreground" />
          )}
        </div>
        <div className="flex gap-2">
          <label className="cursor-pointer">
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                onPick(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <span className="inline-flex items-center rounded-lg border border-input px-3 py-2 text-sm font-medium hover:bg-secondary">
              {file ? "Change" : "Upload"}
            </span>
          </label>
          {file ? (
            <Button variant="ghost" size="sm" onClick={onClear}>
              Remove
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
