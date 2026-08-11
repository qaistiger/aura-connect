import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { UserAvatar } from "@/components/UserAvatar";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

type Mode = "followers" | "following";

type Row = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  is_verified: boolean;
};

export function FollowListDialog({
  userId,
  mode,
  open,
  onOpenChange,
}: {
  userId: string | undefined;
  mode: Mode;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["follow-list", userId, mode],
    enabled: open && !!userId,
    queryFn: async (): Promise<Row[]> => {
      const relation =
        mode === "followers"
          ? "profiles!follows_follower_profile_fkey(id,username,display_name,avatar_url,is_verified)"
          : "profiles!follows_following_profile_fkey(id,username,display_name,avatar_url,is_verified)";
      const column = mode === "followers" ? "following_id" : "follower_id";
      const { data, error } = await supabase
        .from("follows")
        .select(`person:${relation}`)
        .eq(column, userId!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return ((data ?? []) as unknown as { person: Row | null }[])
        .map((r) => r.person)
        .filter((p): p is Row => !!p);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="capitalize">{mode}</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <Skeleton className="h-40 w-full rounded-xl" />
        ) : data.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {mode === "followers" ? "No followers yet." : "Not following anyone yet."}
          </p>
        ) : (
          <ul className="max-h-[60vh] space-y-1 overflow-y-auto">
            {data.map((p) => (
              <li key={p.id}>
                <Link
                  to="/u/$username"
                  params={{ username: p.username }}
                  onClick={() => onOpenChange(false)}
                  className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-secondary/60"
                >
                  <UserAvatar url={p.avatar_url} name={p.display_name || p.username} />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1 truncate text-sm font-semibold">
                      {p.display_name || p.username}
                      {p.is_verified ? <VerifiedBadge className="size-3.5" /> : null}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">@{p.username}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
