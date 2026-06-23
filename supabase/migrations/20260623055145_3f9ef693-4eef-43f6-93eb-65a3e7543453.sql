
CREATE POLICY "evidence_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'evidence' AND (storage.foldername(name))[1] = public.current_org_id()::text);
CREATE POLICY "evidence_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'evidence' AND (storage.foldername(name))[1] = public.current_org_id()::text);
CREATE POLICY "evidence_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'evidence' AND (storage.foldername(name))[1] = public.current_org_id()::text);
