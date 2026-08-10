import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Heart, MessageCircle, MoreHorizontal, Share2, Flag, Trash2, Lock, Globe2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { FeedPost } from "@/lib/types";
import { SignedMedia } from "@/components/SignedMedia";
import { UserAvatar } from "@/components/UserAvatar";
import { ReportDialog, type ReportTarget } from "@/components/ReportDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function PostCard({ post }: { post: FeedPost }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");

  const isOwner = user?.id === post.user_id;
  const authorName = post.author?.display_name || post.author?.username || "Someone";

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
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      queryClient.invalidateQueries({ queryKey: ["profile-posts"] });
    },
    onError: () => toast.error(user ? "Couldn't update your like." : "Sign in to react to posts."),
  });

  const { data: comments = [] } = useQuery({
    queryKey: ["comments", post.id],
    enabled: showComments,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comments")
        .select("id,body,created_at,user_id,author:profiles!comments_author_fkey(username,display_name,avatar_url)")
        .eq("post_id", post.id)
        .order("created_at", { ascending: true })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const addComment = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("auth");
      const body = commentText.trim();
      if (!body) throw new Error("empty");
      const { error } = await supabase
        .from("comments")
        .insert({ post_id: post.id, user_id: user.id, body: body.slice(0, 1000) });
      if (error) throw error;
    },
    onSuccess: () => {
      setCommentText("");
      queryClient.invalidateQueries({ queryKey: ["comments", post.id] });
      queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
    onError: () => toast.error(user ? "Couldn't post your comment." : "Sign in to comment."),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("posts").delete().eq("id", post.id);
      if (error) throw error;
      await supabase.storage.from("media").remove([post.media_path]);
    },
    onSuccess: () => {
      toast.success("Post deleted");
      queryClient.invalidateQueries();
    },
    onError: () => toast.error("We couldn't delete that post."),
  });

  const share = async () => {
    const url = `${window.location.origin}/u/${post.author?.username ?? ""}`;
    try {
      if (navigator.share) await navigator.share({ title: `${authorName} on AURALIS`, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch {
      /* user dismissed */
    }
  };

  return (
    <article className="glass-panel elevate overflow-hidden rounded-2xl hover:elevate-hover">
      <header className="flex items-center gap-3 p-4">
        <Link to="/u/$username" params={{ username: post.author?.username ?? "" }}>
          <UserAvatar url={post.author?.avatar_url} name={authorName} />
        </Link>
        <div className="min-w-0 flex-1">
          <Link
            to="/u/$username"
            params={{ username: post.author?.username ?? "" }}
            className="block truncate text-sm font-semibold hover:text-primary"
          >
            {authorName}
          </Link>
          <p className="truncate text-xs text-muted-foreground">
            @{post.author?.username} · {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
          </p>
        </div>
        {post.visibility === "only_me" ? (
          <Badge variant="secondary" className="gap-1">
            <Lock className="size-3" /> Only me
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1 text-muted-foreground">
            <Globe2 className="size-3" /> Public
          </Badge>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Post options">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {isOwner ? (
              <DropdownMenuItem onSelect={() => setConfirmDelete(true)} className="text-destructive">
                <Trash2 className="size-4" /> Delete post
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onSelect={() =>
                  setReportTarget({ type: "post", id: post.id, label: `${authorName}'s post` })
                }
              >
                <Flag className="size-4" /> Report post
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <SignedMedia
        path={post.media_path}
        kind={post.media_kind}
        alt={post.caption || `${authorName}'s ${post.media_kind}`}
        className="max-h-[70vh] bg-background/60"
      />

      <div className="space-y-3 p-4">
        {post.caption ? <p className="text-sm leading-relaxed">{post.caption}</p> : null}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className={liked ? "text-destructive" : ""}
            onClick={() => toggleLike.mutate()}
          >
            <Heart className={liked ? "size-4 fill-current" : "size-4"} /> {post.like_count}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowComments((v) => !v)}>
            <MessageCircle className="size-4" /> {post.comment_count}
          </Button>
          {post.visibility === "public" ? (
            <Button variant="ghost" size="sm" onClick={share}>
              <Share2 className="size-4" /> Share
            </Button>
          ) : null}
        </div>

        {showComments ? (
          <div className="space-y-3 border-t border-border pt-3">
            {comments.length === 0 ? (
              <p className="text-xs text-muted-foreground">No comments yet — start the conversation.</p>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="flex gap-2">
                  <UserAvatar
                    url={c.author?.avatar_url}
                    name={c.author?.display_name || c.author?.username || "U"}
                    className="size-7"
                  />
                  <div className="min-w-0 flex-1 rounded-lg bg-secondary/50 px-3 py-2">
                    <p className="text-xs font-semibold">@{c.author?.username}</p>
                    <p className="text-sm break-words">{c.body}</p>
                  </div>
                </div>
              ))
            )}
            {user ? (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  addComment.mutate();
                }}
              >
                <Input
                  value={commentText}
                  maxLength={1000}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Add a comment…"
                />
                <Button type="submit" size="sm" disabled={addComment.isPending || !commentText.trim()}>
                  Post
                </Button>
              </form>
            ) : null}
          </div>
        ) : null}
      </div>

      <ReportDialog
        target={reportTarget}
        open={!!reportTarget}
        onOpenChange={(v) => !v && setReportTarget(null)}
      />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this post?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the media and all its likes and comments. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep post</AlertDialogCancel>
            <AlertDialogAction onClick={() => remove.mutate()}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}
