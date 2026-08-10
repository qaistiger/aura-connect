import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Bell, Heart, UserPlus } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { UserAvatar } from "@/components/UserAvatar";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — AURALIS" },
      { name: "description", content: "New followers and reactions to your AURALIS posts, all in one place." },
      { property: "og:title", content: "Notifications — AURALIS" },
      { property: "og:description", content: "Your latest AURALIS activity." },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { user } = useAuth();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id,type,created_at,is_read,actor:profiles!notifications_actor_profile_fkey(username,display_name,avatar_url)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="font-display text-2xl font-extrabold">Notifications</h1>

      {isLoading ? (
        <Skeleton className="h-24 w-full rounded-2xl" />
      ) : items.length === 0 ? (
        <div className="glass-panel rounded-2xl p-12 text-center">
          <Bell className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            No activity yet. Follows and likes will appear here.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li key={n.id} className="glass-panel flex items-center gap-3 rounded-xl p-3">
              <UserAvatar
                url={n.actor?.avatar_url}
                name={n.actor?.display_name || n.actor?.username || "U"}
              />
              <div className="min-w-0 flex-1 text-sm">
                <Link
                  to="/u/$username"
                  params={{ username: n.actor?.username ?? "" }}
                  className="font-semibold hover:text-primary"
                >
                  @{n.actor?.username ?? "someone"}
                </Link>{" "}
                <span className="text-muted-foreground">
                  {n.type === "follow" ? "started following you" : "liked your post"}
                </span>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                </p>
              </div>
              {n.type === "follow" ? (
                <UserPlus className="size-4 text-primary" />
              ) : (
                <Heart className="size-4 text-destructive" />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
