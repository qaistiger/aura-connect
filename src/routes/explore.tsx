import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { POST_SELECT, type FeedPost } from "@/lib/types";
import { SignedMedia } from "@/components/SignedMedia";
import { UserAvatar } from "@/components/UserAvatar";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/explore")({
  head: () => ({
    meta: [
      { title: "Explore ZYNORAIO — people, photos and video" },
      {
        name: "description",
        content: "Search ZYNORAIO for people and discover public photos and videos. Private posts never appear here.",
      },
      { property: "og:title", content: "Explore ZYNORAIO" },
      { property: "og:description", content: "Discover people and public media on ZYNORAIO." },
    ],
  }),
  component: Explore,
});

function Explore() {
  const [term, setTerm] = useState("");
  const q = term.trim().toLowerCase();

  const { data: people = [], isLoading: peopleLoading } = useQuery({
    queryKey: ["search-people", q],
    enabled: q.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("username,display_name,avatar_url,bio")
        .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
        .eq("is_suspended", false)
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: posts = [], isLoading: postsLoading } = useQuery({
    queryKey: ["explore-posts", q],
    queryFn: async () => {
      let query = supabase
        .from("posts")
        .select(POST_SELECT)
        .eq("visibility", "public")
        .eq("is_removed", false)
        .order("created_at", { ascending: false })
        .limit(36);
      if (q.length >= 2) query = query.ilike("caption", `%${q}%`);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as FeedPost[];
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold">Explore</h1>
        <p className="text-sm text-muted-foreground">
          Find people and public media. Only Me posts are never searchable.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search people, usernames or captions"
          className="pl-9"
          aria-label="Search ZYNORAIO"
        />
      </div>

      <Tabs defaultValue="media">
        <TabsList>
          <TabsTrigger value="media">Media</TabsTrigger>
          <TabsTrigger value="people">People</TabsTrigger>
        </TabsList>

        <TabsContent value="media" className="mt-4">
          {postsLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="aspect-square rounded-xl" />
              ))}
            </div>
          ) : posts.length === 0 ? (
            <p className="glass-panel rounded-2xl p-10 text-center text-sm text-muted-foreground">
              No public media matches that search yet.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {posts.map((p) => (
                <Link
                  key={p.id}
                  to="/u/$username"
                  params={{ username: p.author?.username ?? "" }}
                  className="elevate group overflow-hidden rounded-xl border border-border hover:elevate-hover"
                >
                  <SignedMedia
                    path={p.media_path}
                    kind={p.media_kind}
                    alt={p.caption || "Public post"}
                    controls={false}
                    className="aspect-square"
                  />
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="people" className="mt-4 space-y-2">
          {q.length < 2 ? (
            <p className="glass-panel rounded-2xl p-10 text-center text-sm text-muted-foreground">
              Type at least 2 characters to search for people.
            </p>
          ) : peopleLoading ? (
            <Skeleton className="h-20 w-full rounded-xl" />
          ) : people.length === 0 ? (
            <p className="glass-panel rounded-2xl p-10 text-center text-sm text-muted-foreground">
              No accounts found for “{term}”.
            </p>
          ) : (
            people.map((p) => (
              <Link
                key={p.username}
                to="/u/$username"
                params={{ username: p.username }}
                className="glass-panel elevate flex items-center gap-3 rounded-xl p-3 hover:elevate-hover"
              >
                <UserAvatar url={p.avatar_url} name={p.display_name || p.username} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{p.display_name || p.username}</p>
                  <p className="truncate text-xs text-muted-foreground">@{p.username}</p>
                </div>
              </Link>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
