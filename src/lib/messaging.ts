import { supabase } from "@/integrations/supabase/client";

export type ConversationStatus = "pending" | "accepted" | "rejected";

export type ConversationParty = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
};

export type Conversation = {
  id: string;
  user_a: string;
  user_b: string;
  requested_by: string;
  status: ConversationStatus;
  last_message_at: string;
  created_at: string;
  a: ConversationParty | null;
  b: ConversationParty | null;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
  attachment_path: string | null;
  attachment_kind: "photo" | "video" | "audio" | "file" | null;
  attachment_mime: string | null;
  flagged: boolean;
};

export const MESSAGE_SELECT =
  "id,conversation_id,sender_id,body,read_at,created_at,attachment_path,attachment_kind,attachment_mime,flagged";


export const CONVERSATION_SELECT =
  "id,user_a,user_b,requested_by,status,last_message_at,created_at," +
  "a:profiles!conversations_user_a_profile_fkey(id,username,display_name,avatar_url)," +
  "b:profiles!conversations_user_b_profile_fkey(id,username,display_name,avatar_url)";

export function otherParty(conversation: Conversation, meId: string): ConversationParty | null {
  return conversation.user_a === meId ? conversation.b : conversation.a;
}

export function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export async function getOrCreateConversation(meId: string, otherId: string): Promise<Conversation> {
  const [userA, userB] = orderedPair(meId, otherId);

  const { data: existing, error: findError } = await supabase
    .from("conversations")
    .select(CONVERSATION_SELECT)
    .eq("user_a", userA)
    .eq("user_b", userB)
    .maybeSingle();
  if (findError) throw findError;
  if (existing) return existing as unknown as Conversation;

  const { data, error } = await supabase
    .from("conversations")
    .insert({ user_a: userA, user_b: userB, requested_by: meId })
    .select(CONVERSATION_SELECT)
    .single();
  if (error) throw error;
  return data as unknown as Conversation;
}
