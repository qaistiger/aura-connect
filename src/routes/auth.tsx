import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Apple, Chrome, Lock, ShieldCheck, Sparkles } from "lucide-react";

import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/lib/auth";
import { BrandLockup } from "@/components/Brand";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in to AURALIS" },
      {
        name: "description",
        content: "Sign in to AURALIS with Google or Apple to post photos and videos with full privacy control.",
      },
      { property: "og:title", content: "Sign in to AURALIS" },
      { property: "og:description", content: "Secure sign-in with Google or Apple." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [pending, setPending] = useState<"google" | "apple" | null>(null);

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
    <div className="mx-auto flex max-w-md flex-col items-center py-10">
      <BrandLockup className="mb-8" />
      <div className="glass-panel w-full rounded-2xl p-8">
        <h1 className="font-display text-2xl font-extrabold">Sign in</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Use a trusted provider. We never see or store your password.
        </p>

        <div className="mt-6 space-y-3">
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
  );
}
