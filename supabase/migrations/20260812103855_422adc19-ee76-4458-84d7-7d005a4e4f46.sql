ALTER TABLE public.foodie_profiles
  ADD COLUMN IF NOT EXISTS ig_url text,
  ADD COLUMN IF NOT EXISTS areas text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS submission_url text,
  ADD COLUMN IF NOT EXISTS submitted_at timestamp with time zone;

DROP POLICY IF EXISTS applications_creator_update ON public.applications;
CREATE POLICY applications_creator_update ON public.applications
  FOR UPDATE TO authenticated
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());