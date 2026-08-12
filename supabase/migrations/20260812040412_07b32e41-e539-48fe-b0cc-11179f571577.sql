CREATE TABLE public.saved_posts (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);
GRANT SELECT, INSERT, DELETE ON public.saved_posts TO authenticated;
GRANT ALL ON public.saved_posts TO service_role;
ALTER TABLE public.saved_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own saves" ON public.saved_posts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "create own saves" ON public.saved_posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete own saves" ON public.saved_posts FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.reposts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, post_id)
);
GRANT SELECT ON public.reposts TO anon;
GRANT SELECT, INSERT, DELETE ON public.reposts TO authenticated;
GRANT ALL ON public.reposts TO service_role;
ALTER TABLE public.reposts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reposts are viewable" ON public.reposts FOR SELECT USING (true);
CREATE POLICY "create own reposts" ON public.reposts FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.visibility = 'public' AND p.is_removed = false)
);
CREATE POLICY "delete own reposts" ON public.reposts FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS reposts_user_idx ON public.reposts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS saved_posts_user_idx ON public.saved_posts (user_id, created_at DESC);