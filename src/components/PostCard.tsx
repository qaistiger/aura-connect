import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  Bookmark,
  Globe2,
  Heart,
  Link2,
  Lock,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Repeat2,
  Share2,
  Flag,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { FeedPost } from "@/lib/types";
import { SignedMedia } from "@/components/SignedMedia";
import { UserAvatar } from "@/components/UserAvatar";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { ReportDialog, type ReportTarget } from "@/components/ReportDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
  const [editing, setEditing] = useState(false);
  const [draftCaption, setDraftCaption] = useState(post.caption);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");

  const isOwner = user?.id === post.user_id;
  const authorName = post.author?.display_name || post.author?.username || "Someone";
  const postUrl = `${typeof window === "undefined" ? "" : window.location.origin}/u/${post.author?.username ?? ""}`;

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

  const { data: saved = false } = useQuery({
    queryKey: ["saved", post.id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("saved_posts")
        .select("post_id")
        .eq("post_id", post.id)
        .eq("user_id", user!.id)
        .maybeSingle();
      return !!data;
    },
  });

  const { data: reposted = false } = useQuery({
    queryKey: ["reposted", post.id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("reposts")
        .select("id")
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

  const toggleSave = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("auth");
      if (saved) {
        const { error } = await supabase
          .from("saved_posts")
          .delete()
          .eq("post_id", post.id)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("saved_posts").insert({ post_id: post.id, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(saved ? "Removed from saved" : "Saved to your collection");
      queryClient.invalidateQueries({ queryKey: ["saved"] });
      queryClient.invalidateQueries({ queryKey: ["saved-posts"] });
    },
    onError: () => toast.error(user ? "Couldn't update saved posts." : "Sign in to save posts."),
  });

  const toggleRepost = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("auth");
      if (reposted) {
        const { error } = await supabase
          .from("reposts")
          .delete()
          .eq("post_id", post.id)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("reposts").insert({ post_id: post.id, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(reposted ? "Repost removed" : "Reposted to your profile");
      queryClient.invalidateQueries({ queryKey: ["reposted"] });
      queryClient.invalidateQueries({ queryKey: ["profile-reposts"] });
    },
    onError: () =>
      toast.error(user ? "Only public posts can be reposted." : "Sign in to repost."),
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

  const saveCaption = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("posts")
        .update({ caption: draftCaption.trim().slice(0, 2200) })
        .eq("id", post.id);
      if (error) throw error;
    },
    onSuccess: () => {
      setEditing(false);
      toast.success("Post updated");
      queryClient.invalidateQueries();
    },
    onError: () => toast.error("We couldn't update that post."),
  });

  const setVisibility = useMutation({
    mutationFn: async (visibility: "public" | "only_me") => {
      const { error } = await supabase.from("posts").update({ visibility }).eq("id", post.id);
      if (error) throw error;
    },
    onSuccess: (_d, visibility) => {
      toast.success(visibility === "public" ? "Post is now public" : "Post is now private");
      queryClient.invalidateQueries();
    },
    onError: () => toast.error("We couldn't change the privacy of that post."),
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
    try {
      if (navigator.share) await navigator.share({ title: `${authorName} on AURALIS`, url: postUrl });
      else {
        await navigator.clipboard.writeText(postUrl);
        toast.success("Link copied");
      }
    } catch {
      /* user dismissed */
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(postUrl);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy the link.");
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
            className="flex items-center gap-1 truncate text-sm font-semibold hover:text-primary"
          >
            <span className="truncate">{authorName}</span>
            {post.author?.is_verified ? <VerifiedBadge className="size-3.5 shrink-0" /> : null}
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
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onSelect={() => void copyLink()}>
              <Link2 className="size-4" /> Copy link
            </DropdownMenuItem>
            {user ? (
              <DropdownMenuItem onSelect={() => toggleSave.mutate()}>
                <Bookmark className="size-4" /> {saved ? "Remove from saved" : "Save post"}
              </DropdownMenuItem>
            ) : null}
            {isOwner ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => {
                    setDraftCaption(post.caption);
                    setEditing(true);
                  }}
                >
                  <Pencil className="size-4" /> Edit caption
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() =>
                    setVisibility.mutate(post.visibility === "public" ? "only_me" : "public")
                  }
                >
                  {post.visibility === "public" ? (
                    <>
                      <Lock className="size-4" /> Make private
                    </>
                  ) : (
                    <>
                      <Globe2 className="size-4" /> Make public
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setConfirmDelete(true)} className="text-destructive">
                  <Trash2 className="size-4" /> Delete post
                </DropdownMenuItem>
              </>
            ) : (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() =>
                    setReportTarget({ type: "post", id: post.id, label: `${authorName}'s post` })
                  }
                >
                  <Flag className="size-4" /> Report post
                </DropdownMenuItem>
              </>
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
            <Button
              variant="ghost"
              size="sm"
              className={reposted ? "text-accent" : ""}
              onClick={() => toggleRepost.mutate()}
              aria-label="Repost"
            >
              <Repeat2 className="size-4" />
              <span className="hidden sm:inline">{reposted ? "Reposted" : "Repost"}</span>
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            className={saved ? "text-highlight" : ""}
            onClick={() => toggleSave.mutate()}
            aria-label="Save post"
          >
            <Bookmark className={saved ? "size-4 fill-current" : "size-4"} />
            <span className="hidden sm:inline">{saved ? "Saved" : "Save"}</span>
          </Button>
          {post.visibility === "public" ? (
            <Button variant="ghost" size="sm" onClick={share}>
              <Share2 className="size-4" />
              <span className="hidden sm:inline">Share</span>
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

      <Dialog open={editing} onOpenChange={(v) => !v && setEditing(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit caption</DialogTitle>
            <DialogDescription>Only the caption can be changed — the media stays the same.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={draftCaption}
            maxLength={2200}
            onChange={(e) => setDraftCaption(e.target.value)}
            placeholder="Say something about this…"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(false)} disabled={saveCaption.isPending}>
              Cancel
            </Button>
            <Button onClick={() => saveCaption.mutate()} disabled={saveCaption.isPending}>
              {saveCaption.isPending ? "Saving…" : "Save caption"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
