
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS setup_complete boolean NOT NULL DEFAULT false;
UPDATE public.profiles SET setup_complete = true WHERE setup_complete = false;

INSERT INTO public.platform_settings(key, value)
VALUES ('branding', '{"site_name":"AURALIS","tagline":"Your world, your feed","logo_url":null}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ============ LOGIN PHOTOS ============
CREATE TABLE public.login_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url text NOT NULL,
  caption text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.login_photos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.login_photos TO authenticated;
GRANT ALL ON public.login_photos TO service_role;
ALTER TABLE public.login_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "login photos readable" ON public.login_photos FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins insert login photos" ON public.login_photos FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "admins update login photos" ON public.login_photos FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "admins delete login photos" ON public.login_photos FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- ============ BLOCKS ============
CREATE TABLE public.blocks (
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id)
);
GRANT SELECT, INSERT, DELETE ON public.blocks TO authenticated;
GRANT ALL ON public.blocks TO service_role;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own blocks" ON public.blocks FOR SELECT TO authenticated USING (blocker_id = auth.uid());
CREATE POLICY "create own blocks" ON public.blocks FOR INSERT TO authenticated WITH CHECK (blocker_id = auth.uid() AND blocked_id <> auth.uid());
CREATE POLICY "remove own blocks" ON public.blocks FOR DELETE TO authenticated USING (blocker_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_blocked_between(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.blocks WHERE (blocker_id = _a AND blocked_id = _b) OR (blocker_id = _b AND blocked_id = _a));
$$;

CREATE OR REPLACE FUNCTION public.are_mutual_follows(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.follows WHERE follower_id = _a AND following_id = _b)
     AND EXISTS (SELECT 1 FROM public.follows WHERE follower_id = _b AND following_id = _a);
$$;

-- ============ CONVERSATIONS ============
CREATE TYPE public.conversation_status AS ENUM ('pending','accepted','rejected');

CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.conversation_status NOT NULL DEFAULT 'pending',
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT conversations_pair_order CHECK (user_a < user_b),
  CONSTRAINT conversations_pair_unique UNIQUE (user_a, user_b)
);
ALTER TABLE public.conversations ADD CONSTRAINT conversations_user_a_profile_fkey FOREIGN KEY (user_a) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.conversations ADD CONSTRAINT conversations_user_b_profile_fkey FOREIGN KEY (user_b) REFERENCES public.profiles(id) ON DELETE CASCADE;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_conversation_member(_conv uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = _conv AND (c.user_a = _uid OR c.user_b = _uid));
$$;

CREATE OR REPLACE FUNCTION public.can_send_message(_conv uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = _conv
      AND (c.user_a = _uid OR c.user_b = _uid)
      AND NOT public.is_blocked_between(c.user_a, c.user_b)
      AND (c.status = 'accepted' OR (c.status = 'pending' AND c.requested_by = _uid))
  );
$$;

CREATE POLICY "read own conversations" ON public.conversations FOR SELECT TO authenticated
  USING (user_a = auth.uid() OR user_b = auth.uid());
CREATE POLICY "start conversations" ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (
    requested_by = auth.uid()
    AND (user_a = auth.uid() OR user_b = auth.uid())
    AND NOT public.is_blocked_between(user_a, user_b)
  );
CREATE POLICY "respond to conversations" ON public.conversations FOR UPDATE TO authenticated
  USING (user_a = auth.uid() OR user_b = auth.uid())
  WITH CHECK (user_a = auth.uid() OR user_b = auth.uid());
CREATE POLICY "delete own conversations" ON public.conversations FOR DELETE TO authenticated
  USING (user_a = auth.uid() OR user_b = auth.uid());

CREATE OR REPLACE FUNCTION public.conversation_autoaccept()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.are_mutual_follows(NEW.user_a, NEW.user_b) THEN
    NEW.status := 'accepted';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER conversations_autoaccept BEFORE INSERT ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.conversation_autoaccept();

CREATE OR REPLACE FUNCTION public.guard_conversation_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.user_a := OLD.user_a;
  NEW.user_b := OLD.user_b;
  NEW.requested_by := OLD.requested_by;
  IF NEW.status IS DISTINCT FROM OLD.status AND auth.uid() = OLD.requested_by THEN
    NEW.status := OLD.status;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER conversations_guard BEFORE UPDATE ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.guard_conversation_update();

-- ============ MESSAGES ============
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT messages_body_len CHECK (char_length(body) BETWEEN 1 AND 4000)
);
CREATE INDEX messages_conversation_idx ON public.messages (conversation_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read conversation messages" ON public.messages FOR SELECT TO authenticated
  USING (public.is_conversation_member(conversation_id, auth.uid()));
CREATE POLICY "send messages" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.can_send_message(conversation_id, auth.uid()));
CREATE POLICY "mark messages read" ON public.messages FOR UPDATE TO authenticated
  USING (public.is_conversation_member(conversation_id, auth.uid()) AND sender_id <> auth.uid())
  WITH CHECK (public.is_conversation_member(conversation_id, auth.uid()) AND sender_id <> auth.uid());

CREATE OR REPLACE FUNCTION public.bump_conversation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.conversations SET last_message_at = NEW.created_at WHERE id = NEW.conversation_id;
  RETURN NULL;
END; $$;
CREATE TRIGGER messages_bump AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.bump_conversation();

REVOKE EXECUTE ON FUNCTION public.conversation_autoaccept() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_conversation_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bump_conversation() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.conversations REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
