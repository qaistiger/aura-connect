
CREATE POLICY "own media read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "public post media read" ON storage.objects FOR SELECT
  USING (bucket_id = 'media' AND EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.media_path = storage.objects.name AND p.visibility = 'public' AND p.is_removed = false
  ));

CREATE POLICY "admin media read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'media' AND public.is_admin(auth.uid()));

CREATE POLICY "own media insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "own media delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "admin media delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'media' AND public.is_admin(auth.uid()));
