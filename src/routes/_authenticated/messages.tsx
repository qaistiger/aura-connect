import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Ban,
  Camera,
  Check,
  ImagePlus,
  Loader2,
  MessageSquare,
  Paperclip,
  Phone,
  Search,
  Send,
  ShieldAlert,
  Trash2,
  Video,
  X,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  CONVERSATION_SELECT,
  MESSAGE_SELECT,
  otherParty,
  type Conversation,
  type Message,
} from "@/lib/messaging";
import { MEDIA_BUCKET, validateChatFile } from "@/lib/media";
import { MODERATION_WARNING, logModerationEvent, scanText } from "@/lib/moderation";
import { UserAvatar } from "@/components/UserAvatar";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { ChatAttachment } from "@/components/chat/ChatAttachment";
import { VoiceRecorder } from "@/components/chat/VoiceRecorder";
import { CallOverlay } from "@/components/chat/CallOverlay";
import { useCall } from "@/components/chat/useCall";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
      { title: "Messages — chat, voice notes and calls" },
      {
        name: "description",
        content:
          "Full-screen private messaging with voice notes, photo and file sharing, plus audio and video calls.",
      },
      { property: "og:title", content: "Messages" },
      {
        property: "og:description",
        content: "Private direct messages, voice notes, media sharing and calling.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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
  const [filter, setFilter] = useState("");

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

  const matches = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((k) => {
      const person = otherParty(k, meId);
      return (
        (person?.username ?? "").toLowerCase().includes(q) ||
        (person?.display_name ?? "").toLowerCase().includes(q)
      );
    });
  }, [conversations, filter, meId]);

  const inbox = useMemo(
    () => matches.filter((k) => k.status === "accepted" || k.requested_by === meId),
    [matches, meId],
  );
  const requests = useMemo(
    () => matches.filter((k) => k.status === "pending" && k.requested_by !== meId),
    [matches, meId],
  );

  const active = conversations.find((k) => k.id === activeId) ?? null;

  const open = (id: string) => {
    setActiveId(id);
    void navigate({ search: { c: id }, replace: true });
  };

  if (!meId) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 top-16 z-20 bg-background">
      <div className="mx-auto grid h-full w-full max-w-[1400px] md:grid-cols-[340px_1fr]">
        <aside
          className={cn(
            "flex h-full min-h-0 flex-col border-r border-border",
            active && "hidden md:flex",
          )}
        >
          <div className="border-b border-border p-4">
            <h1 className="font-display text-lg font-extrabold">Messages</h1>
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Search conversations"
                className="pl-9"
                maxLength={60}
              />
            </div>
          </div>
          <Tabs defaultValue="inbox" className="flex min-h-0 flex-1 flex-col">
            <div className="px-4 pt-3">
              <TabsList className="w-full">
                <TabsTrigger value="inbox" className="flex-1">
                  Inbox ({inbox.length})
                </TabsTrigger>
                <TabsTrigger value="requests" className="flex-1">
                  Requests ({requests.length})
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="inbox" className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
              <ConversationList
                items={inbox}
                meId={meId}
                activeId={activeId}
                loading={isLoading}
                onOpen={open}
                empty="No conversations yet. Open someone's profile and tap Message."
              />
            </TabsContent>
            <TabsContent value="requests" className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
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
        </aside>

        <section className={cn("flex h-full min-h-0 flex-col", !active && "hidden md:flex")}>
          {active ? (
            <Thread
              key={active.id}
              conversation={active}
              meId={meId}
              onBack={() => {
                setActiveId(null);
                void navigate({ search: {}, replace: true });
              }}
            />
          ) : (
            <div className="flex w-full flex-1 flex-col items-center justify-center gap-2 p-10 text-center text-sm text-muted-foreground">
              <MessageSquare className="size-10 text-primary" />
              Pick a conversation to start chatting.
            </div>
          )}
        </section>
      </div>
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
  if (items.length === 0) return <p className="px-1 py-6 text-sm text-muted-foreground">{empty}</p>;

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
                  {k.status === "pending"
                    ? k.requested_by === meId
                      ? " · request sent"
                      : " · request"
                    : ""}
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
  const [pending, setPending] = useState<{ file: File; url: string } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const call = useCall(conversation.id, meId);

  const isRequester = conversation.requested_by === meId;
  const isPendingForMe = conversation.status === "pending" && !isRequester;
  const canSend = conversation.status === "accepted" || isRequester;

  const { data: messages = [] } = useQuery({
    queryKey: ["messages", conversation.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select(MESSAGE_SELECT)
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as unknown as Message[];
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, conversation.id]);

  const attach = (file: File) => {
    const check = validateChatFile(file);
    if (!check.ok) {
      toast.error(check.error);
      return;
    }
    setPending({ file, url: URL.createObjectURL(file) });
  };

  const send = useMutation({
    mutationFn: async (override?: File) => {
      const text = body.trim();
      const file = override ?? pending?.file ?? null;
      if (!text && !file) return { flagged: false };

      const hit = text ? scanText(text) : null;
      let attachment: { path: string; kind: string; mime: string } | null = null;

      if (file) {
        const check = validateChatFile(file);
        if (!check.ok) throw new Error(check.error);
        const ext = (file.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
        const path = `${meId}/chat/${conversation.id}/${crypto.randomUUID()}.${ext || "bin"}`;
        const { error: uploadError } = await supabase.storage
          .from(MEDIA_BUCKET)
          .upload(path, file, { contentType: file.type || "application/octet-stream" });
        if (uploadError) throw uploadError;
        attachment = { path, kind: check.kind, mime: file.type || "application/octet-stream" };
      }

      const { error } = await supabase.from("messages").insert({
        conversation_id: conversation.id,
        sender_id: meId,
        body: text,
        attachment_path: attachment?.path ?? null,
        attachment_kind: (attachment?.kind ?? null) as never,
        attachment_mime: attachment?.mime ?? null,
        flagged: !!hit,
        flag_reason: hit ? hit.category : null,
      });
      if (error) throw error;

      if (hit) {
        await logModerationEvent({
          userId: meId,
          conversationId: conversation.id,
          hit,
          excerpt: text,
        });
      }
      return { flagged: !!hit };
    },
    onSuccess: (result) => {
      setBody("");
      setPending(null);
      if (result?.flagged) {
        toast.warning("Policy warning", { description: MODERATION_WARNING, duration: 9000 });
      }
      queryClient.invalidateQueries({ queryKey: ["messages", conversation.id] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (error: Error) =>
      toast.error("Message not sent", {
        description: error.message || "You may be blocked or offline.",
      }),
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

  const peerName = person?.display_name || person?.username || "User";

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <CallOverlay call={call} peerName={peerName} peerAvatar={person?.avatar_url ?? null} />

      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={onBack} aria-label="Back">
          <ArrowLeft className="size-4" />
        </Button>
        <UserAvatar url={person?.avatar_url} name={peerName} className="size-9" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 truncate text-sm font-semibold">
            {peerName}
            {person && "is_verified" in person && (person as { is_verified?: boolean }).is_verified ? (
              <VerifiedBadge className="size-3.5" />
            ) : null}
          </p>
          <p className="truncate text-xs text-muted-foreground">@{person?.username ?? "unknown"}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Start audio call"
          disabled={!canSend}
          onClick={() => void call.startCall("audio")}
        >
          <Phone className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Start video call"
          disabled={!canSend}
          onClick={() => void call.startCall("video")}
        >
          <Video className="size-4" />
        </Button>
      </header>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {isPendingForMe ? "This person wants to message you." : "Say hello 👋"}
          </p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={cn("flex", m.sender_id === meId ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[80%] space-y-2 rounded-2xl px-3.5 py-2 text-sm",
                  m.sender_id === meId
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-foreground",
                )}
              >
                {m.attachment_path && m.attachment_kind ? (
                  <ChatAttachment path={m.attachment_path} kind={m.attachment_kind} />
                ) : null}
                {m.body ? <p className="whitespace-pre-wrap break-words">{m.body}</p> : null}
                <p className="flex items-center gap-1 text-[10px] opacity-70">
                  {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  {m.flagged ? (
                    <>
                      <ShieldAlert className="size-3" /> flagged
                    </>
                  ) : null}
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
        <div className="border-t border-border p-3">
          {pending ? (
            <div className="mb-2 flex items-center gap-3 rounded-xl border border-border bg-secondary/40 p-2">
              {pending.file.type.startsWith("image/") ? (
                <img src={pending.url} alt="" className="size-14 rounded-lg object-cover" />
              ) : (
                <span className="truncate text-xs">{pending.file.name}</span>
              )}
              <span className="flex-1 truncate text-xs text-muted-foreground">
                Ready to send · {(pending.file.size / 1024 / 1024).toFixed(1)} MB
              </span>
              <Button variant="ghost" size="icon" aria-label="Remove attachment" onClick={() => setPending(null)}>
                <X className="size-4" />
              </Button>
            </div>
          ) : null}

          <form
            className="flex items-end gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              send.mutate(undefined);
            }}
          >
            <input
              ref={galleryRef}
              type="file"
              accept="image/*,video/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) attach(f);
                e.target.value = "";
              }}
            />
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) attach(f);
                e.target.value = "";
              }}
            />
            <input
              ref={fileRef}
              type="file"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) attach(f);
                e.target.value = "";
              }}
            />

            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={!canSend}
              aria-label="Add photo or video from gallery"
              onClick={() => galleryRef.current?.click()}
            >
              <ImagePlus className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="md:hidden"
              disabled={!canSend}
              aria-label="Take a photo"
              onClick={() => cameraRef.current?.click()}
            >
              <Camera className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={!canSend}
              aria-label="Attach a file"
              onClick={() => fileRef.current?.click()}
            >
              <Paperclip className="size-4" />
            </Button>
            <VoiceRecorder disabled={!canSend || send.isPending} onRecorded={(file) => send.mutate(file)} />

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
                  send.mutate(undefined);
                }
              }}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!canSend || (!body.trim() && !pending) || send.isPending}
            >
              {send.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
