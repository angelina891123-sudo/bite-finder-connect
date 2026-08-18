CREATE TYPE public.foodie_subscription_status AS ENUM ('inactive', 'active', 'expired');

ALTER TABLE public.merchant_profiles
  ADD COLUMN IF NOT EXISTS foodie_subscription_status public.foodie_subscription_status NOT NULL DEFAULT 'inactive';

INSERT INTO public.merchant_profiles (user_id, store_name, region, contact_name, email)
SELECT ur.user_id,
  COALESCE(p.restaurant_name, p.display_name, '未命名店家'),
  p.region,
  p.display_name,
  NULL
FROM public.user_roles ur
JOIN public.profiles p ON p.id = ur.user_id
WHERE ur.role = 'merchant'
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, restaurant_name, instagram_handle, region)
  VALUES (NEW.id,
    NEW.raw_user_meta_data ->> 'display_name',
    NEW.raw_user_meta_data ->> 'restaurant_name',
    NEW.raw_user_meta_data ->> 'instagram_handle',
    NEW.raw_user_meta_data ->> 'region')
  ON CONFLICT (id) DO NOTHING;

  IF NEW.raw_user_meta_data ->> 'role' IN ('merchant','creator') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, (NEW.raw_user_meta_data ->> 'role')::public.app_role)
    ON CONFLICT DO NOTHING;
  END IF;

  IF NEW.raw_user_meta_data ->> 'role' = 'merchant' THEN
    INSERT INTO public.merchant_profiles (user_id, store_name, region, contact_name, email)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data ->> 'restaurant_name', NEW.raw_user_meta_data ->> 'display_name', '未命名店家'),
      NEW.raw_user_meta_data ->> 'region',
      NEW.raw_user_meta_data ->> 'display_name',
      NEW.email
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS visit_code text,
  ADD COLUMN IF NOT EXISTS visited boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS visited_at timestamptz;

UPDATE public.applications
SET visit_code = lpad((floor(random() * 1000000))::int::text, 6, '0')
WHERE status = 'approved' AND visit_code IS NULL;

CREATE OR REPLACE FUNCTION public.handle_application_visit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_merchant boolean;
BEGIN
  is_merchant := public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = NEW.campaign_id AND c.merchant_id = auth.uid()
  );

  IF NEW.visited IS DISTINCT FROM OLD.visited AND NOT is_merchant THEN
    RAISE EXCEPTION '只有商家可以核銷到店代碼';
  END IF;
  IF NEW.visit_code IS DISTINCT FROM OLD.visit_code AND NOT is_merchant THEN
    RAISE EXCEPTION '不可自行變更到店代碼';
  END IF;

  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' AND NEW.visit_code IS NULL THEN
    NEW.visit_code := lpad((floor(random() * 1000000))::int::text, 6, '0');
  END IF;

  IF NEW.visited AND NOT OLD.visited THEN
    NEW.visited_at := now();
  ELSIF NOT NEW.visited THEN
    NEW.visited_at := NULL;
  END IF;

  RETURN NEW;
END; $$;

REVOKE ALL ON FUNCTION public.handle_application_visit() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_applications_visit ON public.applications;
CREATE TRIGGER trg_applications_visit
BEFORE UPDATE ON public.applications
FOR EACH ROW EXECUTE FUNCTION public.handle_application_visit();

UPDATE public.applications
SET completed = true,
    completed_at = COALESCE(completed_at, submitted_at, now())
WHERE submission_url IS NOT NULL
  AND completed = false;

ALTER TABLE public.foodie_profiles
  ADD COLUMN IF NOT EXISTS tiktok_handle text,
  ADD COLUMN IF NOT EXISTS tiktok_followers integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_social_handle text,
  ADD COLUMN IF NOT EXISTS other_social_followers integer NOT NULL DEFAULT 0;

CREATE TYPE public.foodie_plan AS ENUM ('basic', 'pro', 'enterprise');

ALTER TABLE public.merchant_profiles
  ADD COLUMN IF NOT EXISTS foodie_plan public.foodie_plan;

CREATE TYPE public.settlement_status AS ENUM ('pending','invoiced','paid','void');

CREATE TABLE public.settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period text NOT NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  platform_fee numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'TWD',
  status public.settlement_status NOT NULL DEFAULT 'pending',
  note text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (application_id)
);

CREATE INDEX idx_settlements_period ON public.settlements(period);
CREATE INDEX idx_settlements_merchant ON public.settlements(merchant_id);
CREATE INDEX idx_settlements_status ON public.settlements(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.settlements TO authenticated;
GRANT ALL ON public.settlements TO service_role;
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settlements_select" ON public.settlements FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR merchant_id = auth.uid());
CREATE POLICY "settlements_admin_insert" ON public.settlements FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "settlements_admin_update" ON public.settlements FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "settlements_admin_delete" ON public.settlements FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_settlements_updated BEFORE UPDATE ON public.settlements
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP INDEX IF EXISTS public.idx_merchant_profiles_plan;
ALTER TABLE public.merchant_profiles DROP COLUMN IF EXISTS plan;

DROP POLICY IF EXISTS "applications_update" ON public.applications;
CREATE POLICY "applications_update" ON public.applications FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.guard_application_decision() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION '媒合審核結果僅限平台管理員變更';
  END IF;

  IF NEW.completed IS DISTINCT FROM OLD.completed THEN
    RAISE EXCEPTION '合作完成標記僅限平台管理員變更';
  END IF;

  RETURN NEW;
END; $$;

REVOKE ALL ON FUNCTION public.guard_application_decision() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_applications_decision_guard ON public.applications;
CREATE TRIGGER trg_applications_decision_guard
BEFORE UPDATE ON public.applications
FOR EACH ROW EXECUTE FUNCTION public.guard_application_decision();

ALTER TABLE public.foodie_profiles
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS age integer;

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS result_images text[] NOT NULL DEFAULT '{}'::text[];

DROP POLICY IF EXISTS "performance_shots_auth_read" ON storage.objects;
CREATE POLICY "performance_shots_auth_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'performance-shots');

DROP POLICY IF EXISTS "performance_shots_owner_insert" ON storage.objects;
CREATE POLICY "performance_shots_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'performance-shots' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "performance_shots_owner_update" ON storage.objects;
CREATE POLICY "performance_shots_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'performance-shots' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "performance_shots_owner_delete" ON storage.objects;
CREATE POLICY "performance_shots_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'performance-shots' AND (storage.foldername(name))[1] = auth.uid()::text);