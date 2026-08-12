import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clapperboard, Heart, MessageCircle } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { POST_SELECT, type FeedPost } from "@/lib/types";
import { getSignedUrl } from "@/lib/media";
import { UserAvatar } from "@/components/UserAvatar";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/shorts")({
  head: () => ({
    meta: [
      { title: "Shorts — quick vertical videos on AURALIS" },
      {
        name: "description",
        content: "Scroll a full-screen feed of short vertical videos from creators across AURALIS.",
      },
      { property: "og:title", content: "Shorts on AURALIS" },
      { property: "og:description", content: "A full-screen feed of short vertical videos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ShortsPage,
});

function ShortsPage() {
  const { data: shorts = [], isLoading } = useQuery({
    queryKey: ["shorts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select(POST_SELECT)
        .eq("is_short", true)
        .eq("visibility", "public")
        .eq("is_removed", false)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as unknown as FeedPost[];
    },
  });

  if (isLoading) return <Skeleton className="h-[70vh] w-full max-w-sm rounded-2xl" />;

  if (shorts.length === 0) {
    return (
      <div className="glass-panel mx-auto max-w-md rounded-2xl p-12 text-center">
        <Clapperboard className="mx-auto size-8 text-accent" />
        <h1 className="mt-4 font-display text-lg font-bold">No shorts yet</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Upload a video and switch on “Publish as a Short” to start this feed.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto h-[calc(100vh-11rem)] w-full max-w-sm snap-y snap-mandatory overflow-y-auto rounded-2xl">
      <h1 className="sr-only">Shorts</h1>
      {shorts.map((short) => (
        <ShortItem key={short.id} post={short} />
      ))}
    </div>
  );
}

function ShortItem({ post }: { post: FeedPost }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(false);

  const { data: src } = useQuery({
    queryKey: ["signed-url", post.media_path],
    queryFn: () => getSignedUrl(post.media_path),
    staleTime: 50 * 60 * 1000,
  });

  const { data: liked = false } = useQuery({
    queryKey: ["like", post.id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("likes")
        .select("post_id")
        .eq("post_id", post.id)
        .eq("user_id", user!.id)
        .maybeSingle();
      return !!data;
    },
  });

  const toggleLike = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("auth");
      if (liked) {
        const { error } = await supabase
          .from("likes")
          .delete()
          .eq("post_id", post.id)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("likes").insert({ post_id: post.id, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["like", post.id] });
      queryClient.invalidateQueries({ queryKey: ["shorts"] });
    },
    onError: () => toast.error(user ? "Couldn't update your like." : "Sign in to react to shorts."),
  });

  useEffect(() => {
    const node = videoRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const isVisible = !!entry && entry.intersectionRatio > 0.6;
        setVisible(isVisible);
        if (isVisible) void node.play().catch(() => undefined);
        else node.pause();
      },
      { threshold: [0, 0.6, 1] },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [src]);

  const authorName = post.author?.display_name || post.author?.username || "Someone";

  return (
    <section className="relative h-full snap-start overflow-hidden rounded-2xl bg-black">
      {src ? (
        <video
          ref={videoRef}
          src={src}
          className="size-full object-contain"
          playsInline
          loop
          muted={!visible}
          controls
          preload="metadata"
        />
      ) : (
        <Skeleton className="size-full" />
      )}

      <div className="absolute inset-x-0 bottom-0 space-y-2 bg-gradient-to-t from-background/90 to-transparent p-4">
        <Link
          to="/u/$username"
          params={{ username: post.author?.username ?? "" }}
          className="flex items-center gap-2"
        >
          <UserAvatar url={post.author?.avatar_url} name={authorName} className="size-9" />
          <span className="flex min-w-0 items-center gap-1 truncate text-sm font-semibold">
            <span className="truncate">@{post.author?.username}</span>
            {post.author?.is_verified ? <VerifiedBadge className="size-3.5 shrink-0" /> : null}
          </span>
        </Link>
        {post.caption ? <p className="line-clamp-2 text-sm">{post.caption}</p> : null}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            className={liked ? "text-destructive" : ""}
            onClick={() => toggleLike.mutate()}
          >
            <Heart className={liked ? "size-4 fill-current" : "size-4"} /> {post.like_count}
          </Button>
          <Button asChild size="sm" variant="secondary">
            <Link to="/u/$username" params={{ username: post.author?.username ?? "" }}>
              <MessageCircle className="size-4" /> {post.comment_count}
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
