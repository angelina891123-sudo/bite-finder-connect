CREATE POLICY "profiles_merchant_read_applicants" ON public.profiles
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.applications a
  JOIN public.campaigns c ON c.id = a.campaign_id
  WHERE a.creator_id = profiles.id AND c.merchant_id = auth.uid()
));