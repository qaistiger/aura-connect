import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Eye, EyeOff, Loader2, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { BrandLockup } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/setup")({
  head: () => ({
    meta: [
      { title: "Finish setting up your profile" },
      {
        name: "description",
        content: "Choose your full name, a unique username and a password to finish creating your account.",
      },
      { property: "og:title", content: "Profile setup" },
      { property: "og:description", content: "Set your name, username and password to get started." },
    ],
  }),
  component: SetupPage,
});

const USERNAME_RE = /^[a-z0-9_]{3,24}$/;

function SetupPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setFullName((v) => v || profile.display_name || "");
    setUsername((v) => v || profile.username || "");
    if (profile.setup_complete) navigate({ to: "/", replace: true });
  }, [profile, navigate]);

  const normalized = username.trim().toLowerCase();
  const formatValid = USERNAME_RE.test(normalized);
  const isMine = normalized === profile?.username;

  const { data: available, isFetching: checking } = useQuery({
    queryKey: ["username-available", normalized],
    enabled: formatValid && !isMine,
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

  const usernameOk = formatValid && (isMine || available === true);
  const passwordOk = password.length >= 8 && password === confirm;
  const nameOk = fullName.trim().length >= 2;

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("auth");
      const { error: passError } = await supabase.auth.updateUser({ password });
      if (passError) throw passError;
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: fullName.trim(),
          username: normalized,
          setup_complete: true,
        })
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      toast.success("You're all set!");
      navigate({ to: "/", replace: true });
    },
    onError: (e: unknown) =>
      toast.error("Couldn't finish setup", {
        description: e instanceof Error ? e.message : "Please try again.",
      }),
  });

  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-8">
      <BrandLockup className="mb-6" />
      <div className="glass-panel w-full rounded-2xl p-7">
        <h1 className="font-display text-2xl font-extrabold">Set up your profile</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A few details and your account is ready to use.
        </p>

        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (usernameOk && passwordOk && nameOk) save.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="fullName">Your full name</Label>
            <Input
              id="fullName"
              value={fullName}
              maxLength={60}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Alex Rivera"
              autoComplete="name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">Set your username</Label>
            <Input
              id="username"
              value={username}
              maxLength={24}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              placeholder="alexrivera"
              autoComplete="username"
            />
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {checking ? (
                <>
                  <Loader2 className="size-3 animate-spin" /> Checking availability…
                </>
              ) : !formatValid ? (
                "3–24 characters — lowercase letters, numbers and underscores."
              ) : usernameOk ? (
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
            <Label htmlFor="password">Set your password</Label>
            <div className="relative">
              <Input
                id="password"
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                className="pr-10"
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
            <Label htmlFor="confirm">Confirm your password</Label>
            <Input
              id="confirm"
              type={show ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat password"
              autoComplete="new-password"
            />
            {confirm.length > 0 && password !== confirm ? (
              <p className="text-xs text-destructive">Passwords don't match.</p>
            ) : null}
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={!usernameOk || !passwordOk || !nameOk || save.isPending}
          >
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Continue
          </Button>
        </form>
      </div>
    </div>
  );
}
