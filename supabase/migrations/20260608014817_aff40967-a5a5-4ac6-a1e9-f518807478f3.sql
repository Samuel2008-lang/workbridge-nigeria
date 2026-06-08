
-- chat-media: path convention is `{job_id}/{user_id}/{filename}`
CREATE POLICY "chat media read parties" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'chat-media'
  AND (
    public.has_role(auth.uid(),'admin')
    OR EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id::text = (storage.foldername(name))[1]
        AND (j.client_id = auth.uid() OR j.hired_worker_id = auth.uid())
    )
  )
);

CREATE POLICY "chat media upload own folder" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chat-media'
  AND auth.uid()::text = (storage.foldername(name))[2]
  AND EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id::text = (storage.foldername(name))[1]
      AND (j.client_id = auth.uid() OR j.hired_worker_id = auth.uid())
  )
);

CREATE POLICY "chat media delete own" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'chat-media'
  AND auth.uid()::text = (storage.foldername(name))[2]
);
