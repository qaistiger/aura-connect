import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Apple, Chrome, Eye, EyeOff, Lock, ShieldCheck, Sparkles } from "lucide-react";

import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { BrandLockup } from "@/components/Brand";
import { LoginShowcase } from "@/components/LoginShowcase";
import { useBranding } from "@/lib/branding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in to ZYNORAIO" },
      {
        name: "description",
        content: "Sign in to ZYNORAIO with Google or Apple to post photos and videos with full privacy control.",
      },
      { property: "og:title", content: "Sign in to ZYNORAIO" },
      { property: "og:description", content: "Secure sign-in with Google or Apple." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { user, loading } = useAuth();
  const branding = useBranding();
  const navigate = useNavigate();
  const [pending, setPending] = useState<"google" | "apple" | "email" | null>(null);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const address = email.trim();
    if (!address || password.length < 6) {
      toast.error("Check your details", { description: "Enter your email and a password of 6+ characters." });
      return;
    }
    setPending("email");
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email: address, password });
        if (error) throw error;
        navigate({ to: "/", replace: true });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: address,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (data.session) navigate({ to: "/", replace: true });
        else
          toast.success("Check your email", {
            description: "Confirm your address to finish creating your account.",
          });
      }
    } catch (error) {
      toast.error(mode === "signin" ? "Sign-in failed" : "Sign-up failed", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setPending(null);
    }
  };

  useEffect(() => {
    if (!loading && user) navigate({ to: "/", replace: true });
  }, [user, loading, navigate]);

  const signIn = async (provider: "google" | "apple") => {
    setPending(provider);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error("Sign-in failed", { description: "Please try again in a moment." });
        setPending(null);
        return;
      }
      if (result.redirected) return;
      navigate({ to: "/", replace: true });
    } catch {
      toast.error("Sign-in failed", { description: "Please check your connection and try again." });
      setPending(null);
    }
  };

  return (
    <div className="mx-auto grid max-w-5xl items-start gap-8 py-10 lg:grid-cols-[1.1fr_minmax(360px,420px)]">
      <div className="order-2 space-y-4 lg:order-1">
        <LoginShowcase />
      </div>

      <div className="order-1 flex flex-col items-center lg:order-2">
      <BrandLockup className="mb-8" />
      <div className="glass-panel w-full rounded-2xl p-8">
        <h1 className="font-display text-2xl font-extrabold">
          {mode === "signin" ? "Sign in" : "Create your account"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === "signin"
            ? `Sign in to continue to ${branding.site_name}.`
            : `Join ${branding.site_name} — you'll pick your username next.`}
        </p>

        <form onSubmit={submitEmail} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={pending !== null}>
            {pending === "email" ? "Please wait…" : mode === "signin" ? "Sign In" : "Create account"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            {mode === "signin" ? "New to " : "Already have an account? "}
            {mode === "signin" ? branding.site_name : null}
            <button
              type="button"
              className="ml-1 font-semibold text-primary hover:underline"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin" ? "Create an account" : "Sign in instead"}
            </button>
          </p>
        </form>

        <div className="my-6 flex items-center gap-3 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
          <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
        </div>

        <div className="space-y-3">
          <Button
            className="w-full justify-center gap-2"
            size="lg"
            onClick={() => signIn("google")}
            disabled={pending !== null}
          >
            <Chrome className="size-4" />
            {pending === "google" ? "Connecting…" : "Continue with Google"}
          </Button>
          <Button
            className="w-full justify-center gap-2"
            size="lg"
            variant="outline"
            onClick={() => signIn("apple")}
            disabled={pending !== null}
          >
            <Apple className="size-4" />
            {pending === "apple" ? "Connecting…" : "Continue with Apple"}
          </Button>
        </div>

        <ul className="mt-8 space-y-3 text-xs text-muted-foreground">
          <li className="flex gap-2">
            <Lock className="size-4 shrink-0 text-primary" /> Your private posts stay private — always.
          </li>
          <li className="flex gap-2">
            <ShieldCheck className="size-4 shrink-0 text-accent" /> Server-side access rules protect every
            account.
          </li>
          <li className="flex gap-2">
            <Sparkles className="size-4 shrink-0 text-highlight" /> Your username is reserved the moment you
            claim it.
          </li>
        </ul>
      </div>
      </div>
    </div>
  );
}
