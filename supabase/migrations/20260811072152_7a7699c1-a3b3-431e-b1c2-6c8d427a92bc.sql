CREATE TYPE public.verification_status AS ENUM ('pending','approved','rejected');

ALTER TABLE public.merchant_profiles
  ADD COLUMN verification_status public.verification_status NOT NULL DEFAULT 'pending',
  ADD COLUMN reviewed_at timestamptz,
  ADD COLUMN review_note text;

ALTER TABLE public.foodie_profiles
  ADD COLUMN verification_status public.verification_status NOT NULL DEFAULT 'pending',
  ADD COLUMN reviewed_at timestamptz,
  ADD COLUMN review_note text;

ALTER TABLE public.applications
  ADD COLUMN completed boolean NOT NULL DEFAULT false,
  ADD COLUMN completed_at timestamptz;

CREATE POLICY "merchant_profiles_admin_all" ON public.merchant_profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "foodie_profiles_admin_all" ON public.foodie_profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "applications_admin_read" ON public.applications
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));