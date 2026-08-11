ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS youtube_url text,
  ADD COLUMN IF NOT EXISTS instagram_url text,
  ADD COLUMN IF NOT EXISTS facebook_url text,
  ADD COLUMN IF NOT EXISTS whatsapp_number text;

ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS is_short boolean NOT NULL DEFAULT false;

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS attachment_path text,
  ADD COLUMN IF NOT EXISTS attachment_kind text,
  ADD COLUMN IF NOT EXISTS attachment_mime text,
  ADD COLUMN IF NOT EXISTS flagged boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS flag_reason text;

ALTER TABLE public.messages ALTER COLUMN body SET DEFAULT '';
ALTER TABLE public.messages ALTER COLUMN body DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.guard_profile_moderation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    NEW.is_suspended := OLD.is_suspended;
    NEW.suspension_reason := OLD.suspension_reason;
    NEW.is_verified := OLD.is_verified;
  END IF;
  RETURN NEW;
END; $function$;

CREATE TABLE IF NOT EXISTS public.moderation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  category text NOT NULL,
  matched_terms text NOT NULL DEFAULT '',
  excerpt text NOT NULL DEFAULT '',
  severity text NOT NULL DEFAULT 'warning',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.moderation_events TO authenticated;
GRANT ALL ON public.moderation_events TO service_role;
ALTER TABLE public.moderation_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "log own moderation events" ON public.moderation_events
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "admins read moderation events" ON public.moderation_events
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "read own moderation events" ON public.moderation_events
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.profile_media_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.profile_media_history TO authenticated;
GRANT ALL ON public.profile_media_history TO service_role;
ALTER TABLE public.profile_media_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "insert own profile media history" ON public.profile_media_history
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "read own profile media history" ON public.profile_media_history
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "admins read profile media history" ON public.profile_media_history
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "admins read all conversations" ON public.conversations
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "admins read all messages" ON public.messages
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS messages_flagged_idx ON public.messages (flagged, created_at DESC);
CREATE INDEX IF NOT EXISTS posts_short_idx ON public.posts (is_short, created_at DESC);

CREATE OR REPLACE FUNCTION public.can_read_message_attachment(_path text, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.messages m
    JOIN public.conversations c ON c.id = m.conversation_id
    WHERE m.attachment_path = _path AND (c.user_a = _uid OR c.user_b = _uid)
  );
$function$;
REVOKE ALL ON FUNCTION public.can_read_message_attachment(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_message_attachment(text, uuid) TO authenticated;

CREATE POLICY "conversation members read attachments" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'media' AND public.can_read_message_attachment(name, auth.uid()));