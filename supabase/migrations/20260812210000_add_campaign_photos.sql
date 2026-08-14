ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS photos text[] NOT NULL DEFAULT '{}'::text[];

INSERT INTO storage.buckets (id, name, public)
VALUES ('campaign-photos', 'campaign-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "campaign_photos_public_read" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'campaign-photos');

CREATE POLICY "campaign_photos_merchant_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'campaign-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "campaign_photos_merchant_delete" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'campaign-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
