import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Ban, Check, Loader2, MessageSquare, Send, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  CONVERSATION_SELECT,
  otherParty,
  type Conversation,
  type Message,
} from "@/lib/messaging";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Search = { c?: string };

export const Route = createFileRoute("/_authenticated/messages")({
  validateSearch: (search: Record<string, unknown>): Search =>
    typeof search['c'] === "string" ? { c: search['c'] } : {},
  head: () => ({
    meta: [
      { title: "Messages — direct chat and requests" },
      {
        name: "description",
        content:
          "Chat privately with people you follow, review message requests, and block unwanted senders.",
      },
      { property: "og:title", content: "Messages" },
      { property: "og:description", content: "Private direct messages and message requests." },
    ],
  }),
  component: MessagesPage,
});

function MessagesPage() {
  const { user } = useAuth();
  const meId = user?.id ?? "";
  const queryClient = useQueryClient();
  const { c } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [activeId, setActiveId] = useState<string | null>(c ?? null);

  useEffect(() => {
    setActiveId(c ?? null);
  }, [c]);

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ["conversations", meId],
    enabled: !!meId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select(CONVERSATION_SELECT)
        .neq("status", "rejected")
        .order("last_message_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Conversation[];
    },
  });

  useEffect(() => {
    if (!meId) return;
    const channel = supabase
      .channel("dm-inbox")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
        queryClient.invalidateQueries({ queryKey: ["messages"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => {
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [meId, queryClient]);

  const inbox = useMemo(
    () => conversations.filter((k) => k.status === "accepted" || k.requested_by === meId),
    [conversations, meId],
  );
  const requests = useMemo(
    () => conversations.filter((k) => k.status === "pending" && k.requested_by !== meId),
    [conversations, meId],
  );

  const active = conversations.find((k) => k.id === activeId) ?? null;

  const open = (id: string) => {
    setActiveId(id);
    void navigate({ search: { c: id }, replace: true });
  };

  if (!meId) return null;

  return (
    <div className="grid gap-5 md:grid-cols-[320px_1fr]">
      <section className={cn("glass-panel rounded-2xl p-4", active && "hidden md:block")}>
        <h1 className="font-display text-lg font-extrabold">Messages</h1>
        <Tabs defaultValue="inbox" className="mt-3">
          <TabsList className="w-full">
            <TabsTrigger value="inbox" className="flex-1">
              Inbox ({inbox.length})
            </TabsTrigger>
            <TabsTrigger value="requests" className="flex-1">
              Requests ({requests.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="inbox" className="mt-3">
            <ConversationList
              items={inbox}
              meId={meId}
              activeId={activeId}
              loading={isLoading}
              onOpen={open}
              empty="No conversations yet. Open someone's profile and tap Message."
            />
          </TabsContent>
          <TabsContent value="requests" className="mt-3">
            <ConversationList
              items={requests}
              meId={meId}
              activeId={activeId}
              loading={isLoading}
              onOpen={open}
              empty="No message requests right now."
            />
          </TabsContent>
        </Tabs>
      </section>

      <section className={cn("glass-panel min-h-[60vh] rounded-2xl", !active && "hidden md:flex")}>
        {active ? (
          <Thread
            conversation={active}
            meId={meId}
            onBack={() => {
              setActiveId(null);
              void navigate({ search: {}, replace: true });
            }}
          />
        ) : (
          <div className="flex w-full flex-col items-center justify-center gap-2 p-10 text-center text-sm text-muted-foreground">
            <MessageSquare className="size-8 text-primary" />
            Pick a conversation to start chatting.
          </div>
        )}
      </section>
    </div>
  );
}

function ConversationList({
  items,
  meId,
  activeId,
  loading,
  onOpen,
  empty,
}: {
  items: Conversation[];
  meId: string;
  activeId: string | null;
  loading: boolean;
  onOpen: (id: string) => void;
  empty: string;
}) {
  if (loading) return <Skeleton className="h-40 w-full rounded-xl" />;
  if (items.length === 0)
    return <p className="px-1 py-6 text-sm text-muted-foreground">{empty}</p>;

  return (
    <ul className="space-y-1">
      {items.map((k) => {
        const person = otherParty(k, meId);
        return (
          <li key={k.id}>
            <button
              type="button"
              onClick={() => onOpen(k.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors",
                activeId === k.id ? "bg-secondary" : "hover:bg-secondary/60",
              )}
            >
              <UserAvatar
                url={person?.avatar_url}
                name={person?.display_name || person?.username || "User"}
                className="size-10"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {person?.display_name || person?.username || "User"}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  @{person?.username ?? "unknown"}
                  {k.status === "pending" ? (k.requested_by === meId ? " · request sent" : " · request") : ""}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Thread({
  conversation,
  meId,
  onBack,
}: {
  conversation: Conversation;
  meId: string;
  onBack: () => void;
}) {
  const queryClient = useQueryClient();
  const person = otherParty(conversation, meId);
  const [body, setBody] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const isRequester = conversation.requested_by === meId;
  const isPendingForMe = conversation.status === "pending" && !isRequester;
  const canSend = conversation.status === "accepted" || isRequester;

  const { data: messages = [] } = useQuery({
    queryKey: ["messages", conversation.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("id,conversation_id,sender_id,body,read_at,created_at")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as Message[];
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, conversation.id]);

  const send = useMutation({
    mutationFn: async () => {
      const text = body.trim();
      if (!text) return;
      const { error } = await supabase
        .from("messages")
        .insert({ conversation_id: conversation.id, sender_id: meId, body: text });
      if (error) throw error;
    },
    onSuccess: () => {
      setBody("");
      queryClient.invalidateQueries({ queryKey: ["messages", conversation.id] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: () => toast.error("Message not sent", { description: "You may be blocked or offline." }),
  });

  const respond = useMutation({
    mutationFn: async (action: "accept" | "reject" | "block") => {
      if (action === "block") {
        const { error: blockError } = await supabase
          .from("blocks")
          .insert({ blocker_id: meId, blocked_id: person?.id ?? "" });
        if (blockError) throw blockError;
      }
      const { error } = await supabase
        .from("conversations")
        .update({ status: action === "accept" ? "accepted" : "rejected" })
        .eq("id", conversation.id);
      if (error) throw error;
    },
    onSuccess: (_d, action) => {
      toast.success(
        action === "accept" ? "Request accepted" : action === "block" ? "User blocked" : "Request deleted",
      );
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      if (action !== "accept") onBack();
    },
    onError: () => toast.error("Action failed. Please try again."),
  });

  return (
    <div className="flex w-full flex-col">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={onBack} aria-label="Back">
          <ArrowLeft className="size-4" />
        </Button>
        <UserAvatar
          url={person?.avatar_url}
          name={person?.display_name || person?.username || "User"}
          className="size-9"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {person?.display_name || person?.username || "User"}
          </p>
          <p className="truncate text-xs text-muted-foreground">@{person?.username ?? "unknown"}</p>
        </div>
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4" style={{ maxHeight: "55vh" }}>
        {messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {isPendingForMe ? "This person wants to message you." : "Say hello 👋"}
          </p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={cn("flex", m.sender_id === meId ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm",
                  m.sender_id === meId
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-foreground",
                )}
              >
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className="mt-1 text-[10px] opacity-70">
                  {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {isPendingForMe ? (
        <div className="flex flex-wrap gap-2 border-t border-border p-4">
          <Button onClick={() => respond.mutate("accept")} disabled={respond.isPending}>
            <Check className="size-4" /> Accept
          </Button>
          <Button variant="outline" onClick={() => respond.mutate("reject")} disabled={respond.isPending}>
            <Trash2 className="size-4" /> Delete
          </Button>
          <Button variant="ghost" onClick={() => respond.mutate("block")} disabled={respond.isPending}>
            <Ban className="size-4" /> Block
          </Button>
        </div>
      ) : (
        <form
          className="flex items-end gap-2 border-t border-border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            send.mutate();
          }}
        >
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={canSend ? "Write a message…" : "Waiting for this person to accept."}
            rows={1}
            maxLength={4000}
            disabled={!canSend || send.isPending}
            className="max-h-32 min-h-11 resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send.mutate();
              }
            }}
          />
          <Button type="submit" size="icon" disabled={!canSend || !body.trim() || send.isPending}>
            {send.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </form>
      )}
    </div>
  );
}
