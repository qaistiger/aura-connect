CREATE TABLE IF NOT EXISTS public.post_dislikes (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

GRANT SELECT, INSERT, DELETE ON public.post_dislikes TO authenticated;
GRANT ALL ON public.post_dislikes TO service_role;

ALTER TABLE public.post_dislikes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dislikes are readable by signed-in users"
  ON public.post_dislikes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users add their own dislikes"
  ON public.post_dislikes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users remove their own dislikes"
  ON public.post_dislikes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS post_dislikes_post_idx ON public.post_dislikes(post_id);