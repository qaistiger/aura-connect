import { useState } from "react";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Flag, Lock, MessageSquare, Settings } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { POST_SELECT, type FeedPost } from "@/lib/types";
import { getOrCreateConversation } from "@/lib/messaging";
import { PostCard } from "@/components/PostCard";
import { UserAvatar } from "@/components/UserAvatar";
import { ReportDialog, type ReportTarget } from "@/components/ReportDialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/u/$username")({
  head: ({ params }) => ({
    meta: [
      { title: `@${params.username} on AURALIS` },
      {
        name: "description",
        content: `See public photos and videos shared by @${params.username} on AURALIS.`,
      },
      { property: "og:title", content: `@${params.username} on AURALIS` },
      { property: "og:description", content: `Public posts from @${params.username}.` },
    ],
  }),
  component: ProfilePage,
  notFoundComponent: () => (
    <div className="glass-panel mx-auto max-w-md rounded-2xl p-10 text-center">
      <h1 className="font-display text-lg font-bold">Account not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">This username doesn't exist on AURALIS.</p>
    </div>
  ),
});

function ProfilePage() {
  const { username } = Route.useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", username],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,username,display_name,bio,avatar_url,cover_url,is_suspended,created_at")
        .ilike("username", username)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw notFound();
      return data;
    },
  });

  const isSelf = !!user && !!profile && user.id === profile.id;

  const { data: posts = [] } = useQuery({
    queryKey: ["profile-posts", profile?.id, isSelf],
    enabled: !!profile,
    queryFn: async () => {
      let query = supabase
        .from("posts")
        .select(POST_SELECT)
        .eq("user_id", profile!.id)
        .eq("is_removed", false)
        .order("created_at", { ascending: false })
        .limit(60);
      if (!isSelf) query = query.eq("visibility", "public");
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as FeedPost[];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["profile-stats", profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const [followers, following] = await Promise.all([
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", profile!.id),
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", profile!.id),
      ]);
      return { followers: followers.count ?? 0, following: following.count ?? 0 };
    },
  });

  const { data: isFollowing = false } = useQuery({
    queryKey: ["is-following", profile?.id, user?.id],
    enabled: !!profile && !!user && !isSelf,
    queryFn: async () => {
      const { data } = await supabase
        .from("follows")
        .select("follower_id")
        .eq("follower_id", user!.id)
        .eq("following_id", profile!.id)
        .maybeSingle();
      return !!data;
    },
  });

  const navigate = useNavigate();

  const startChat = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("auth");
      return getOrCreateConversation(user.id, profile!.id);
    },
    onSuccess: (conversation) => {
      navigate({ to: "/messages", search: { c: conversation.id } });
    },
    onError: () => toast.error(user ? "Couldn't open chat." : "Sign in to send messages."),
  });

  const toggleFollow = useMutation({
    mutationFn: async () => {
      if (!user || !profile) throw new Error("auth");
      if (isFollowing) {
        const { error } = await supabase
          .from("follows")
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", profile.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("follows")
          .insert({ follower_id: user.id, following_id: profile.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["is-following"] });
      queryClient.invalidateQueries({ queryKey: ["profile-stats"] });
    },
    onError: () => toast.error(user ? "Couldn't update follow." : "Sign in to follow people."),
  });

  if (isLoading) return <Skeleton className="h-64 w-full rounded-2xl" />;
  if (!profile) return null;

  if (profile.is_suspended && !isSelf) {
    return (
      <div className="glass-panel mx-auto max-w-md rounded-2xl p-10 text-center">
        <h1 className="font-display text-lg font-bold">Account unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This account has been suspended for violating our community rules.
        </p>
      </div>
    );
  }

  const publicPosts = posts.filter((p) => p.visibility === "public");
  const privatePosts = posts.filter((p) => p.visibility === "only_me");

  return (
    <div className="space-y-6">
      <header className="glass-panel overflow-hidden rounded-2xl">
        <div className="h-28 sm:h-36" style={{ backgroundImage: "var(--gradient-brand)" }} />
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end">
          <UserAvatar
            url={profile.avatar_url}
            name={profile.display_name || profile.username}
            className="-mt-14 size-24 border-4 border-background"
          />
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-xl font-extrabold">
              {profile.display_name || profile.username}
            </h1>
            <p className="text-sm text-muted-foreground">@{profile.username}</p>
            {profile.bio ? <p className="mt-2 max-w-xl text-sm">{profile.bio}</p> : null}
            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              <span>
                <strong>{publicPosts.length}</strong>{" "}
                <span className="text-muted-foreground">posts</span>
              </span>
              <span>
                <strong>{stats?.followers ?? 0}</strong>{" "}
                <span className="text-muted-foreground">followers</span>
              </span>
              <span>
                <strong>{stats?.following ?? 0}</strong>{" "}
                <span className="text-muted-foreground">following</span>
              </span>
              <span className="flex items-center gap-1 text-muted-foreground">
                <CalendarDays className="size-4" />
                Joined {new Date(profile.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            {isSelf ? (
              <Button asChild variant="outline">
                <Link to="/settings">
                  <Settings className="size-4" /> Edit profile
                </Link>
              </Button>
            ) : (
              <>
                <Button onClick={() => toggleFollow.mutate()} variant={isFollowing ? "outline" : "default"}>
                  {isFollowing ? "Following" : "Follow"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => startChat.mutate()}
                  disabled={startChat.isPending}
                >
                  <MessageSquare className="size-4" /> Message
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Report user"
                  onClick={() =>
                    setReportTarget({ type: "user", id: profile.id, label: `@${profile.username}` })
                  }
                >
                  <Flag className="size-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {isSelf ? (
        <Tabs defaultValue="public">
          <TabsList>
            <TabsTrigger value="public">Public ({publicPosts.length})</TabsTrigger>
            <TabsTrigger value="private" className="gap-1">
              <Lock className="size-3" /> Only me ({privatePosts.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="public" className="mt-4 space-y-5">
            <PostList posts={publicPosts} empty="You haven't shared anything publicly yet." />
          </TabsContent>
          <TabsContent value="private" className="mt-4 space-y-5">
            <PostList posts={privatePosts} empty="Nothing private saved yet. Only you can see this tab." />
          </TabsContent>
        </Tabs>
      ) : (
        <div className="space-y-5">
          <PostList posts={publicPosts} empty="No public posts yet." />
        </div>
      )}

      <ReportDialog
        target={reportTarget}
        open={!!reportTarget}
        onOpenChange={(v) => !v && setReportTarget(null)}
      />
    </div>
  );
}

function PostList({ posts, empty }: { posts: FeedPost[]; empty: string }) {
  if (posts.length === 0) {
    return (
      <p className="glass-panel rounded-2xl p-10 text-center text-sm text-muted-foreground">{empty}</p>
    );
  }
  return (
    <div className="mx-auto max-w-xl space-y-5">
      {posts.map((p) => (
        <PostCard key={p.id} post={p} />
      ))}
    </div>
  );
}
