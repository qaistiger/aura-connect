CREATE TABLE IF NOT EXISTS public.profile_locations (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT '',
  latitude double precision,
  longitude double precision,
  share_consent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_locations TO authenticated;
GRANT ALL ON public.profile_locations TO service_role;

ALTER TABLE public.profile_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage their own location" ON public.profile_locations;
CREATE POLICY "Owners manage their own location"
ON public.profile_locations FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view locations" ON public.profile_locations;
CREATE POLICY "Admins can view locations"
ON public.profile_locations FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));

DROP TRIGGER IF EXISTS profile_locations_touch ON public.profile_locations;
CREATE TRIGGER profile_locations_touch
BEFORE UPDATE ON public.profile_locations
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();