
CREATE POLICY "branding readable" ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'branding');
CREATE POLICY "admins upload branding" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'branding' AND public.is_admin(auth.uid()));
CREATE POLICY "admins update branding" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'branding' AND public.is_admin(auth.uid()))
  WITH CHECK (bucket_id = 'branding' AND public.is_admin(auth.uid()));
CREATE POLICY "admins delete branding" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'branding' AND public.is_admin(auth.uid()));
