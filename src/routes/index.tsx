import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, ShieldCheck, Lock } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { POST_SELECT, type FeedPost } from "@/lib/types";
import { PostCard } from "@/components/PostCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ZYNORAIO — Your feed" },
      {
        name: "description",
        content: "A calm, premium feed of public photos and videos from the people you follow on ZYNORAIO.",
      },
      { property: "og:title", content: "ZYNORAIO — Your feed" },
      { property: "og:description", content: "Share your world, privately or publicly." },
    ],
  }),
  component: Feed,
});

function Feed() {
  const { user, loading } = useAuth();

  const { data: posts, isLoading, isError } = useQuery({
    queryKey: ["feed"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select(POST_SELECT)
        .eq("visibility", "public")
        .eq("is_removed", false)
        .order("created_at", { ascending: false })
        .limit(40);
      if (error) throw error;
      return (data ?? []) as unknown as FeedPost[];
    },
  });

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-5">
        {!user && !loading ? <Hero /> : null}

        <h1 className="sr-only">ZYNORAIO feed</h1>

        {isLoading ? (
          <div className="space-y-5">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-96 w-full rounded-2xl" />
            ))}
          </div>
        ) : isError ? (
          <EmptyState
            title="We couldn't load the feed"
            body="Something went wrong on our side. Please refresh and try again."
          />
        ) : posts && posts.length > 0 ? (
          posts.map((post) => <PostCard key={post.id} post={post} />)
        ) : (
          <EmptyState
            title="Nothing here yet"
            body="Be the first to post something. Photos and videos you mark as Public will show up here."
          />
        )}
      </div>

      <aside className="hidden space-y-4 lg:block">
        <div className="glass-panel rounded-2xl p-5">
          <h2 className="font-display text-sm font-bold tracking-wide uppercase">Why ZYNORAIO</h2>
          <ul className="mt-4 space-y-4 text-sm text-muted-foreground">
            <li className="flex gap-3">
              <Lock className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>
                <strong className="text-foreground">Per-post privacy.</strong> Choose Public or Only Me before
                you publish. Private media never leaves your account.
              </span>
            </li>
            <li className="flex gap-3">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" />
              <span>
                <strong className="text-foreground">Real moderation.</strong> Report anything in one tap; every
                admin action is audited.
              </span>
            </li>
            <li className="flex gap-3">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-highlight" />
              <span>
                <strong className="text-foreground">Photos and video.</strong> One clean home for stills and
                short-form clips.
              </span>
            </li>
          </ul>
        </div>
      </aside>
    </div>
  );
}

function Hero() {
  return (
    <section
      className="overflow-hidden rounded-3xl border border-border p-8 sm:p-12"
      style={{ backgroundImage: "var(--gradient-surface)" }}
    >
      <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">Welcome to ZYNORAIO</p>
      <h2 className="mt-3 max-w-xl text-3xl leading-tight font-extrabold sm:text-4xl">
        Share your world — <span className="brand-text">publicly or privately.</span>
      </h2>
      <p className="mt-3 max-w-lg text-sm text-muted-foreground sm:text-base">
        A premium social home for your photos and videos, with privacy that's built in rather than bolted on.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild size="lg">
          <Link to="/auth">Create your account</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link to="/explore" search={{ q: undefined }}>Explore public posts</Link>
        </Button>
      </div>
    </section>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="glass-panel rounded-2xl p-10 text-center">
      <h3 className="font-display text-lg font-bold">{title}</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

export { redirect };
