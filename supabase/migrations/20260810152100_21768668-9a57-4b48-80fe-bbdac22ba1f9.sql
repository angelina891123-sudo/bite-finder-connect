CREATE TABLE public.foodie_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname text NOT NULL,
  real_name text,
  email text,
  phone text,
  region text,
  area text,
  ig_handle text,
  ig_followers integer NOT NULL DEFAULT 0,
  reels_avg_views integer NOT NULL DEFAULT 0,
  engagement_rate numeric NOT NULL DEFAULT 0,
  threads_handle text,
  threads_followers integer NOT NULL DEFAULT 0,
  youtube_channel text,
  youtube_subscribers integer NOT NULL DEFAULT 0,
  categories text[] NOT NULL DEFAULT '{}',
  collab_preferences text[] NOT NULL DEFAULT '{}',
  portfolio_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.foodie_profiles TO authenticated;
GRANT ALL ON public.foodie_profiles TO service_role;

ALTER TABLE public.foodie_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "foodie_profiles_select_own" ON public.foodie_profiles
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "foodie_profiles_merchant_read_applicants" ON public.foodie_profiles
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.applications a
  JOIN public.campaigns c ON c.id = a.campaign_id
  WHERE a.creator_id = foodie_profiles.user_id AND c.merchant_id = auth.uid()
));

CREATE POLICY "foodie_profiles_insert_own" ON public.foodie_profiles
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "foodie_profiles_update_own" ON public.foodie_profiles
FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_foodie_profiles_updated
BEFORE UPDATE ON public.foodie_profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.merchant_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  store_name text NOT NULL,
  region text,
  address text,
  contact_name text,
  phone text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.merchant_profiles TO authenticated;
GRANT ALL ON public.merchant_profiles TO service_role;

ALTER TABLE public.merchant_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "merchant_profiles_select_own" ON public.merchant_profiles
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "merchant_profiles_insert_own" ON public.merchant_profiles
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "merchant_profiles_update_own" ON public.merchant_profiles
FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_merchant_profiles_updated
BEFORE UPDATE ON public.merchant_profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();