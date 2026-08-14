-- Supersedes the policies created in 20260812210000_add_campaign_photos.sql:
-- both branches added storage policies for this bucket, and campaign_photos_public_read
-- collides by name. Dropping first keeps this migration applicable to databases that
-- already ran the earlier one, and adds the UPDATE policy the earlier one lacked.
DROP POLICY IF EXISTS "campaign_photos_public_read" ON storage.objects;
DROP POLICY IF EXISTS "campaign_photos_merchant_insert" ON storage.objects;
DROP POLICY IF EXISTS "campaign_photos_merchant_delete" ON storage.objects;
DROP POLICY IF EXISTS "campaign_photos_owner_insert" ON storage.objects;
DROP POLICY IF EXISTS "campaign_photos_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "campaign_photos_owner_delete" ON storage.objects;

CREATE POLICY "campaign_photos_public_read" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'campaign-photos');
CREATE POLICY "campaign_photos_owner_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'campaign-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "campaign_photos_owner_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'campaign-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "campaign_photos_owner_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'campaign-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
