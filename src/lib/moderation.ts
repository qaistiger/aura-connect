import { supabase } from "@/integrations/supabase/client";

export type ModerationCategory =
  | "harassment"
  | "sexual_exploitation"
  | "extortion"
  | "illegal_activity";

export type ModerationHit = {
  category: ModerationCategory;
  terms: string[];
};

const RULES: { category: ModerationCategory; patterns: RegExp[] }[] = [
  {
    category: "extortion",
    patterns: [
      /\bblackmail(ing|ed)?\b/i,
      /\bextort(ion|ing)?\b/i,
      /\bi will (leak|expose|post|share) your (photos?|pics?|videos?|nudes?)\b/i,
      /\bpay me\b.{0,30}\b(or|otherwise)\b/i,
      /\bsend money\b.{0,30}\b(or|else)\b/i,
      /\bransom\b/i,
    ],
  },
  {
    category: "sexual_exploitation",
    patterns: [
      /\bsend (me )?(your )?(nudes?|naked|nude pics?|nude photos?)\b/i,
      /\bnudes?\b/i,
      /\bsexting\b/i,
      /\bstrip (for me|on cam)\b/i,
      /\bshow me your (body|boobs|dick|private)\b/i,
      /\bchild (porn|sex)\b/i,
    ],
  },
  {
    category: "harassment",
    patterns: [
      /\bi(?:'| a)?m going to (kill|hurt|beat|destroy) you\b/i,
      /\bkill your ?self\b/i,
      /\bi will find you\b.{0,20}\b(and|then)\b/i,
      /\brape\b/i,
      /\bdeath threat\b/i,
    ],
  },
  {
    category: "illegal_activity",
    patterns: [
      /\b(sell|buy|selling|buying)\b.{0,20}\b(cocaine|heroin|meth|mdma|weed|guns?|pistols?|weapons?)\b/i,
      /\bhitman\b/i,
      /\bfake (passport|id|documents?)\b/i,
      /\bstolen (cards?|credit cards?|accounts?)\b/i,
      /\bhuman trafficking\b/i,
    ],
  },
];

export const MODERATION_LABELS: Record<ModerationCategory, string> = {
  harassment: "Harassment or threats",
  sexual_exploitation: "Sexual exploitation",
  extortion: "Blackmail or extortion",
  illegal_activity: "Illegal activity",
};

export function scanText(text: string): ModerationHit | null {
  const value = text ?? "";
  if (!value.trim()) return null;
  for (const rule of RULES) {
    const terms: string[] = [];
    for (const pattern of rule.patterns) {
      const match = value.match(pattern);
      if (match?.[0]) terms.push(match[0]);
    }
    if (terms.length > 0) return { category: rule.category, terms };
  }
  return null;
}

export const MODERATION_WARNING =
  "Warning: Suspicious/violative behavior detected. This message has been flagged and shared with our safety team. Continued misuse will result in an immediate account ban.";

export async function logModerationEvent(input: {
  userId: string;
  conversationId?: string | null;
  hit: ModerationHit;
  excerpt: string;
}) {
  await supabase.from("moderation_events").insert({
    user_id: input.userId,
    conversation_id: input.conversationId ?? null,
    category: input.hit.category,
    matched_terms: input.hit.terms.join(", ").slice(0, 300),
    excerpt: input.excerpt.slice(0, 500),
    severity: "warning",
  });
}
