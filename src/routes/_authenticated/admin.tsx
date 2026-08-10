import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Ban,
  CheckCircle2,
  FileWarning,
  Flag,
  Search,
  Shield,
  Trash2,
  Users,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { POST_SELECT, type FeedPost } from "@/lib/types";
import { SignedMedia } from "@/components/SignedMedia";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin console — AURALIS" },
      { name: "description", content: "Moderation, analytics and platform controls for AURALIS administrators." },
      { property: "og:title", content: "Admin console — AURALIS" },
      { property: "og:description", content: "Moderation and analytics for AURALIS." },
    ],
  }),
  component: AdminPage,
});

function useAudit() {
  const { user } = useAuth();
  return async (action: string, targetType: string, targetId: string, details: Record<string, unknown> = {}) => {
    if (!user) return;
    await supabase.from("admin_audit_logs").insert({
      admin_id: user.id,
      action,
      target_type: targetType,
      target_id: targetId,
      details,
    });
  };
}

function AdminPage() {
  const { isAdmin, isSuperAdmin, loading } = useAuth();

  if (loading) return <Skeleton className="h-64 w-full rounded-2xl" />;

  if (!isAdmin) {
    return (
      <div className="glass-panel mx-auto max-w-md rounded-2xl p-12 text-center">
        <Shield className="mx-auto size-8 text-destructive" />
        <h1 className="mt-4 font-display text-lg font-bold">Restricted area</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You don't have permission to view the admin console.
        </p>
        <Button asChild className="mt-6">
          <Link to="/">Back to feed</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Admin console</h1>
          <p className="text-sm text-muted-foreground">
            Platform health, moderation and controls. Every action here is recorded.
          </p>
        </div>
        <Badge className="ml-auto gap-1">
          <Shield className="size-3" /> {isSuperAdmin ? "Super admin" : "Moderator"}
        </Badge>
      </header>

      <Tabs defaultValue="overview">
        <TabsList className="flex w-full flex-wrap justify-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-5">
          <Overview />
        </TabsContent>
        <TabsContent value="users" className="mt-5">
          <UsersPanel />
        </TabsContent>
        <TabsContent value="content" className="mt-5">
          <ContentPanel />
        </TabsContent>
        <TabsContent value="reports" className="mt-5">
          <ReportsPanel />
        </TabsContent>
        <TabsContent value="security" className="mt-5">
          <SecurityPanel />
        </TabsContent>
        <TabsContent value="system" className="mt-5">
          <SystemPanel isSuperAdmin={isSuperAdmin} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone = "primary",
}: {
  label: string;
  value: number | string;
  icon: typeof Users;
  tone?: "primary" | "accent" | "highlight" | "destructive";
}) {
  const toneClass = {
    primary: "text-primary",
    accent: "text-accent",
    highlight: "text-highlight",
    destructive: "text-destructive",
  }[tone];
  return (
    <div className="glass-panel rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
        <Icon className={`size-4 ${toneClass}`} />
      </div>
      <p className="mt-3 font-display text-3xl font-extrabold">{value}</p>
    </div>
  );
}

function Overview() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: async () => {
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const dayAgo = new Date(Date.now() - 86400000).toISOString();
      const count = (q: { count: number | null }) => q.count ?? 0;

      const [users, newUsers, active, suspended, posts, videos, reports, pending, recent] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", weekAgo),
        supabase.from("profiles").select("*", { count: "exact", head: true }).gte("last_active_at", dayAgo),
        supabase.from("profiles").select("*", { count: "exact", head: true }).eq("is_suspended", true),
        supabase.from("posts").select("*", { count: "exact", head: true }),
        supabase.from("posts").select("*", { count: "exact", head: true }).eq("media_kind", "video"),
        supabase.from("reports").select("*", { count: "exact", head: true }),
        supabase.from("reports").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("posts").select("created_at").gte("created_at", weekAgo).limit(1000),
      ]);

      const byDay = new Map<string, number>();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000);
        byDay.set(d.toLocaleDateString(undefined, { weekday: "short" }), 0);
      }
      for (const row of recent.data ?? []) {
        const key = new Date(row.created_at).toLocaleDateString(undefined, { weekday: "short" });
        if (byDay.has(key)) byDay.set(key, (byDay.get(key) ?? 0) + 1);
      }

      return {
        users: count(users),
        newUsers: count(newUsers),
        active: count(active),
        suspended: count(suspended),
        posts: count(posts),
        videos: count(videos),
        reports: count(reports),
        pending: count(pending),
        chart: [...byDay.entries()].map(([day, posts]) => ({ day, posts })),
      };
    },
  });

  if (isLoading || !data) return <Skeleton className="h-64 w-full rounded-2xl" />;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total users" value={data.users} icon={Users} />
        <StatCard label="New this week" value={data.newUsers} icon={Activity} tone="accent" />
        <StatCard label="Active (24h)" value={data.active} icon={BarChart3} tone="highlight" />
        <StatCard label="Suspended" value={data.suspended} icon={Ban} tone="destructive" />
        <StatCard label="Total posts" value={data.posts} icon={FileWarning} />
        <StatCard label="Videos" value={data.videos} icon={Video} tone="accent" />
        <StatCard label="Reports" value={data.reports} icon={Flag} tone="highlight" />
        <StatCard label="Pending moderation" value={data.pending} icon={AlertTriangle} tone="destructive" />
      </div>

      <div className="glass-panel rounded-2xl p-5">
        <h2 className="font-display text-sm font-bold tracking-wide uppercase">Posts — last 7 days</h2>
        <div className="mt-4 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.chart}>
              <defs>
                <linearGradient id="postsFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={12} />
              <YAxis allowDecimals={false} stroke="var(--color-muted-foreground)" fontSize={12} />
              <RechartsTooltip
                contentStyle={{
                  background: "var(--color-popover)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="posts"
                stroke="var(--color-chart-1)"
                fill="url(#postsFill)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function UsersPanel() {
  const [term, setTerm] = useState("");
  const queryClient = useQueryClient();
  const audit = useAudit();
  const q = term.trim().toLowerCase();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin", "users", q],
    queryFn: async () => {
      let query = supabase
        .from("profiles")
        .select("id,username,display_name,avatar_url,is_suspended,suspension_reason,created_at,last_active_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (q.length >= 2) query = query.or(`username.ilike.%${q}%,display_name.ilike.%${q}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const setSuspended = useMutation({
    mutationFn: async ({ id, suspended }: { id: string; suspended: boolean }) => {
      const { error } = await supabase
        .from("profiles")
        .update({
          is_suspended: suspended,
          suspension_reason: suspended ? "Policy violation reviewed by moderation" : null,
        })
        .eq("id", id);
      if (error) throw error;
      await audit(suspended ? "suspend_user" : "reinstate_user", "user", id);
    },
    onSuccess: () => {
      toast.success("Account updated");
      queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: () => toast.error("That action didn't go through"),
  });

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search users by name or username"
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <Skeleton className="h-40 w-full rounded-2xl" />
      ) : users.length === 0 ? (
        <p className="glass-panel rounded-2xl p-10 text-center text-sm text-muted-foreground">
          No accounts match that search.
        </p>
      ) : (
        <ul className="space-y-2">
          {users.map((u) => (
            <li key={u.id} className="glass-panel flex flex-wrap items-center gap-3 rounded-xl p-3">
              <UserAvatar url={u.avatar_url} name={u.display_name || u.username} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{u.display_name || u.username}</p>
                <p className="truncate text-xs text-muted-foreground">
                  @{u.username} · joined {new Date(u.created_at).toLocaleDateString()}
                </p>
              </div>
              {u.is_suspended ? <Badge variant="destructive">Suspended</Badge> : <Badge variant="secondary">Active</Badge>}
              <Button asChild variant="ghost" size="sm">
                <Link to="/u/$username" params={{ username: u.username }}>
                  View
                </Link>
              </Button>
              <Button
                variant={u.is_suspended ? "outline" : "destructive"}
                size="sm"
                onClick={() => setSuspended.mutate({ id: u.id, suspended: !u.is_suspended })}
              >
                {u.is_suspended ? "Reinstate" : "Suspend"}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ContentPanel() {
  const queryClient = useQueryClient();
  const audit = useAudit();

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["admin", "content"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select(POST_SELECT)
        .order("created_at", { ascending: false })
        .limit(48);
      if (error) throw error;
      return (data ?? []) as unknown as FeedPost[];
    },
  });

  const moderate = useMutation({
    mutationFn: async ({ id, remove }: { id: string; remove: boolean }) => {
      const { error } = await supabase
        .from("posts")
        .update({
          is_removed: remove,
          removed_reason: remove ? "Removed by moderation" : null,
          flagged: remove,
        })
        .eq("id", id);
      if (error) throw error;
      await audit(remove ? "remove_post" : "restore_post", "post", id);
    },
    onSuccess: () => {
      toast.success("Content updated");
      queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: () => toast.error("That action didn't go through"),
  });

  if (isLoading) return <Skeleton className="h-64 w-full rounded-2xl" />;

  return (
    <>
      <p className="mb-4 rounded-xl border border-highlight/30 bg-highlight/10 p-3 text-xs text-muted-foreground">
        Private “Only me” media is shown here for legitimate safety, legal and policy review only. Every view
        and action is attributed to your admin account in the audit log.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((p) => (
          <div key={p.id} className="glass-panel overflow-hidden rounded-xl">
            <SignedMedia
              path={p.media_path}
              kind={p.media_kind}
              alt={p.caption || "Post under review"}
              controls={false}
              className="aspect-square"
            />
            <div className="space-y-2 p-3">
              <div className="flex items-center gap-2">
                <Badge variant={p.visibility === "public" ? "outline" : "secondary"}>
                  {p.visibility === "public" ? "Public" : "Only me"}
                </Badge>
                {p.is_removed ? <Badge variant="destructive">Removed</Badge> : null}
              </div>
              <p className="truncate text-xs text-muted-foreground">
                @{p.author?.username} · {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}
              </p>
              {p.caption ? <p className="line-clamp-2 text-xs">{p.caption}</p> : null}
              <Button
                size="sm"
                variant={p.is_removed ? "outline" : "destructive"}
                className="w-full"
                onClick={() => moderate.mutate({ id: p.id, remove: !p.is_removed })}
              >
                {p.is_removed ? (
                  <>
                    <CheckCircle2 className="size-4" /> Restore
                  </>
                ) : (
                  <>
                    <Trash2 className="size-4" /> Remove
                  </>
                )}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function ReportsPanel() {
  const queryClient = useQueryClient();
  const audit = useAudit();
  const { user } = useAuth();

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["admin", "reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("id,target_type,target_id,reason,details,status,created_at,reporter:profiles!reports_reporter_profile_fkey(username)")
        .order("created_at", { ascending: false })
        .limit(80);
      if (error) throw error;
      return data ?? [];
    },
  });

  const resolve = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "resolved" | "dismissed" }) => {
      const { error } = await supabase
        .from("reports")
        .update({ status, resolved_by: user?.id ?? null, resolved_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      await audit(`report_${status}`, "report", id);
    },
    onSuccess: () => {
      toast.success("Report updated");
      queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: () => toast.error("That action didn't go through"),
  });

  if (isLoading) return <Skeleton className="h-40 w-full rounded-2xl" />;
  if (reports.length === 0)
    return (
      <p className="glass-panel rounded-2xl p-12 text-center text-sm text-muted-foreground">
        No reports. The queue is clear.
      </p>
    );

  return (
    <ul className="space-y-2">
      {reports.map((r) => (
        <li key={r.id} className="glass-panel flex flex-wrap items-center gap-3 rounded-xl p-4">
          <Flag className="size-4 shrink-0 text-highlight" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">
              {r.reason} <span className="text-muted-foreground">· {r.target_type}</span>
            </p>
            {r.details ? <p className="text-xs text-muted-foreground">{r.details}</p> : null}
            <p className="text-xs text-muted-foreground">
              by @{r.reporter?.username ?? "unknown"} ·{" "}
              {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
            </p>
          </div>
          <Badge variant={r.status === "pending" ? "destructive" : "secondary"}>{r.status}</Badge>
          {r.status === "pending" ? (
            <>
              <Button size="sm" onClick={() => resolve.mutate({ id: r.id, status: "resolved" })}>
                Action taken
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => resolve.mutate({ id: r.id, status: "dismissed" })}
              >
                Dismiss
              </Button>
            </>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function SecurityPanel() {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["admin", "audit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_audit_logs")
        .select("id,action,target_type,target_id,created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) return <Skeleton className="h-40 w-full rounded-2xl" />;

  return (
    <div className="glass-panel rounded-2xl p-5">
      <h2 className="font-display text-sm font-bold tracking-wide uppercase">Admin audit log</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        An immutable trail of every moderation action taken on the platform.
      </p>
      {logs.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">No admin actions recorded yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-border text-sm">
          {logs.map((l) => (
            <li key={l.id} className="flex items-center gap-3 py-2">
              <Shield className="size-4 text-primary" />
              <span className="font-medium">{l.action.replaceAll("_", " ")}</span>
              <span className="text-xs text-muted-foreground">{l.target_type}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(l.created_at), { addSuffix: true })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SystemPanel({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const queryClient = useQueryClient();

  const { data: settings = [] } = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("platform_settings").select("key,value");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: errors = [] } = useQuery({
    queryKey: ["admin", "errors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("error_logs")
        .select("id,level,message,created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ key, enabled }: { key: string; enabled: boolean }) => {
      const { error } = await supabase
        .from("platform_settings")
        .update({ value: { enabled }, updated_at: new Date().toISOString() })
        .eq("key", key);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Setting saved");
      queryClient.invalidateQueries({ queryKey: ["admin", "settings"] });
    },
    onError: () => toast.error("Only a super admin can change platform settings"),
  });

  const flags = settings.filter((s) => typeof (s.value as { enabled?: boolean })?.enabled === "boolean");

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="glass-panel rounded-2xl p-5">
        <h2 className="font-display text-sm font-bold tracking-wide uppercase">Platform settings</h2>
        <div className="mt-4 space-y-3">
          {flags.map((s) => (
            <div key={s.key} className="flex items-center justify-between gap-3">
              <Label htmlFor={s.key} className="text-sm capitalize">
                {s.key.replaceAll("_", " ")}
              </Label>
              <Switch
                id={s.key}
                disabled={!isSuperAdmin}
                checked={!!(s.value as { enabled?: boolean }).enabled}
                onCheckedChange={(v) => toggle.mutate({ key: s.key, enabled: v })}
              />
            </div>
          ))}
          {!isSuperAdmin ? (
            <p className="text-xs text-muted-foreground">Only the super admin can change these.</p>
          ) : null}
        </div>
      </div>

      <div className="glass-panel rounded-2xl p-5">
        <h2 className="font-display text-sm font-bold tracking-wide uppercase">Error monitoring</h2>
        {errors.length === 0 ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-success">
            <CheckCircle2 className="size-4" /> No errors logged. All systems nominal.
          </p>
        ) : (
          <ul className="mt-4 space-y-2 text-sm">
            {errors.map((e) => (
              <li key={e.id} className="rounded-lg bg-secondary/40 p-2">
                <p className="flex items-center gap-2 text-xs font-semibold text-destructive uppercase">
                  <AlertTriangle className="size-3" /> {e.level}
                </p>
                <p className="text-xs break-words">{e.message}</p>
                <p className="text-[11px] text-muted-foreground">
                  {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
