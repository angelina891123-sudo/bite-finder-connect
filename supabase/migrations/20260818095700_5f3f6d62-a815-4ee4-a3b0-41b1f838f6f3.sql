CREATE TYPE public.submission_status AS ENUM ('draft', 'submitted', 'revising', 'approved');

CREATE OR REPLACE FUNCTION public.owns_submission(_application_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.applications a
    WHERE a.id = _application_id AND a.creator_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.merchant_of_submission(_application_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.applications a
    JOIN public.campaigns c ON c.id = a.campaign_id
    WHERE a.id = _application_id AND c.merchant_id = auth.uid()
  )
$$;

REVOKE ALL ON FUNCTION public.owns_submission(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.merchant_of_submission(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owns_submission(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.merchant_of_submission(uuid) TO authenticated;

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS video_direction text,
  ADD COLUMN IF NOT EXISTS video_must_include text,
  ADD COLUMN IF NOT EXISTS video_must_avoid text,
  ADD COLUMN IF NOT EXISTS copy_must_include text,
  ADD COLUMN IF NOT EXISTS copy_must_avoid text,
  ADD COLUMN IF NOT EXISTS hashtags text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS reference_link text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS food_types text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS primary_food_type text;

ALTER TABLE public.campaigns DROP COLUMN IF EXISTS food_type;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'campaigns' AND column_name = 'collab_type'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'campaigns' AND column_name = 'collab_types'
  ) THEN
    ALTER TABLE public.campaigns ADD COLUMN collab_types text[] NOT NULL DEFAULT '{}'::text[];
    UPDATE public.campaigns
      SET collab_types = ARRAY[collab_type]
      WHERE collab_type IS NOT NULL AND collab_type <> '';
    ALTER TABLE public.campaigns DROP COLUMN collab_type;
  END IF;
END $$;

ALTER TABLE public.merchant_profiles
  ADD COLUMN IF NOT EXISTS blacklisted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS blacklist_reason text,
  ADD COLUMN IF NOT EXISTS blacklisted_at timestamptz,
  ADD COLUMN IF NOT EXISTS foodie_subscribed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_merchant_profiles_blacklisted
  ON public.merchant_profiles(blacklisted) WHERE blacklisted;

CREATE OR REPLACE FUNCTION public.guard_merchant_blacklist() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  IF NEW.blacklisted IS DISTINCT FROM OLD.blacklisted
     OR NEW.blacklist_reason IS DISTINCT FROM OLD.blacklist_reason
     OR NEW.blacklisted_at IS DISTINCT FROM OLD.blacklisted_at THEN
    RAISE EXCEPTION '黑名單僅限平台管理員變更';
  END IF;
  RETURN NEW;
END; $$;

REVOKE ALL ON FUNCTION public.guard_merchant_blacklist() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_merchant_blacklist_guard ON public.merchant_profiles;
CREATE TRIGGER trg_merchant_blacklist_guard
BEFORE UPDATE ON public.merchant_profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_merchant_blacklist();

UPDATE public.merchant_profiles
SET foodie_subscribed_at = updated_at
WHERE foodie_subscription_status = 'active' AND foodie_subscribed_at IS NULL;

CREATE OR REPLACE FUNCTION public.track_foodie_subscription() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.foodie_subscription_status = 'active'
     AND OLD.foodie_subscription_status IS DISTINCT FROM 'active' THEN
    NEW.foodie_subscribed_at := now();
  ELSIF NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.foodie_subscribed_at := OLD.foodie_subscribed_at;
  END IF;
  RETURN NEW;
END; $$;

REVOKE ALL ON FUNCTION public.track_foodie_subscription() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_merchant_subscription_time ON public.merchant_profiles;
CREATE TRIGGER trg_merchant_subscription_time
BEFORE UPDATE ON public.merchant_profiles
FOR EACH ROW EXECUTE FUNCTION public.track_foodie_subscription();

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS material_caption text,
  ADD COLUMN IF NOT EXISTS material_media text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS material_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS material_note text,
  ADD COLUMN IF NOT EXISTS material_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS material_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS caption_status public.submission_status NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS media_status public.submission_status NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS caption_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS media_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS caption_review_note text,
  ADD COLUMN IF NOT EXISTS media_review_note text,
  ADD COLUMN IF NOT EXISTS material_caption_prev text,
  ADD COLUMN IF NOT EXISTS selected_media text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS merchant_review_status public.submission_status NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS merchant_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS merchant_review_note text,
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_applications_caption_status ON public.applications(caption_status);
CREATE INDEX IF NOT EXISTS idx_applications_media_status ON public.applications(media_status);
CREATE INDEX IF NOT EXISTS idx_applications_merchant_review ON public.applications(merchant_review_status);

CREATE OR REPLACE FUNCTION public.track_material_caption_history() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.material_caption IS DISTINCT FROM OLD.material_caption THEN
    NEW.material_caption_prev := OLD.material_caption;
    IF NOT public.has_role(auth.uid(), 'admin') THEN
      NEW.caption_status := 'submitted';
      NEW.caption_reviewed_at := NULL;
      NEW.caption_review_note := NULL;
    END IF;
  END IF;

  IF NEW.material_media IS DISTINCT FROM OLD.material_media THEN
    IF NOT public.has_role(auth.uid(), 'admin') THEN
      NEW.media_status := 'submitted';
      NEW.media_reviewed_at := NULL;
      NEW.media_review_note := NULL;
    END IF;
    NEW.selected_media := ARRAY(
      SELECT unnest(NEW.selected_media) INTERSECT SELECT unnest(NEW.material_media)
    );
  END IF;

  RETURN NEW;
END; $$;

REVOKE ALL ON FUNCTION public.track_material_caption_history() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_applications_caption_history ON public.applications;
CREATE TRIGGER trg_applications_caption_history
BEFORE UPDATE ON public.applications
FOR EACH ROW EXECUTE FUNCTION public.track_material_caption_history();

CREATE OR REPLACE FUNCTION public.guard_material_review() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.caption_status = 'approved' AND OLD.caption_status <> 'approved' THEN
    RAISE EXCEPTION '文案確稿僅限平台管理員';
  END IF;

  IF NEW.media_status = 'approved' AND OLD.media_status <> 'approved' THEN
    RAISE EXCEPTION '照片確稿僅限平台管理員';
  END IF;

  IF (NEW.caption_reviewed_at IS NOT NULL AND NEW.caption_reviewed_at IS DISTINCT FROM OLD.caption_reviewed_at)
     OR (NEW.media_reviewed_at IS NOT NULL AND NEW.media_reviewed_at IS DISTINCT FROM OLD.media_reviewed_at) THEN
    RAISE EXCEPTION '確稿時間僅限平台管理員變更';
  END IF;

  IF (NEW.caption_review_note IS NOT NULL
      AND NEW.caption_review_note IS DISTINCT FROM OLD.caption_review_note)
     OR (NEW.media_review_note IS NOT NULL
      AND NEW.media_review_note IS DISTINCT FROM OLD.media_review_note) THEN
    RAISE EXCEPTION '退回修改原因僅限平台管理員填寫';
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(NEW.selected_media) AS s
    WHERE s <> ALL (COALESCE(OLD.selected_media, '{}'))
  ) THEN
    RAISE EXCEPTION '選用照片僅限平台管理員變更';
  END IF;

  RETURN NEW;
END; $$;

REVOKE ALL ON FUNCTION public.guard_material_review() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_applications_material_guard ON public.applications;
CREATE TRIGGER trg_applications_material_guard
BEFORE UPDATE ON public.applications
FOR EACH ROW EXECUTE FUNCTION public.guard_material_review();

CREATE OR REPLACE FUNCTION public.handle_material_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_admin boolean;
  is_merchant boolean;
  is_creator boolean;
BEGIN
  IF NEW.material_status IS NOT DISTINCT FROM OLD.material_status THEN
    RETURN NEW;
  END IF;

  is_admin := public.has_role(auth.uid(), 'admin');
  is_merchant := EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = NEW.campaign_id AND c.merchant_id = auth.uid()
  );
  is_creator := NEW.creator_id = auth.uid();

  IF NEW.material_status = 'admin_pending' THEN
    IF NOT (is_creator OR is_admin) THEN
      RAISE EXCEPTION '只有該 Foodie 可以送出素材審核';
    END IF;
    IF OLD.material_status NOT IN ('draft', 'admin_rejected', 'merchant_rejected') THEN
      RAISE EXCEPTION '目前狀態無法送審';
    END IF;
    NEW.material_submitted_at := now();
    NEW.material_note := NULL;
  ELSIF NEW.material_status IN ('merchant_pending', 'admin_rejected') THEN
    IF NOT is_admin THEN
      RAISE EXCEPTION '只有平台管理員可以進行第一階段審核';
    END IF;
    IF OLD.material_status <> 'admin_pending' THEN
      RAISE EXCEPTION '素材尚未送出管理員審核';
    END IF;
    NEW.material_reviewed_at := now();
  ELSIF NEW.material_status IN ('approved', 'merchant_rejected') THEN
    IF NOT (is_merchant OR is_admin) THEN
      RAISE EXCEPTION '只有商家可以進行第二階段審核';
    END IF;
    IF OLD.material_status <> 'merchant_pending' THEN
      RAISE EXCEPTION '素材尚未通過管理員審核';
    END IF;
    NEW.material_reviewed_at := now();
  ELSIF NEW.material_status = 'draft' THEN
    IF NOT (is_creator OR is_admin) THEN
      RAISE EXCEPTION '無權變更素材狀態';
    END IF;
  ELSE
    RAISE EXCEPTION '未知的素材狀態: %', NEW.material_status;
  END IF;

  IF NEW.material_status IN ('admin_rejected', 'merchant_rejected')
     AND coalesce(btrim(NEW.material_note), '') = '' THEN
    RAISE EXCEPTION '退件必須填寫原因';
  END IF;

  RETURN NEW;
END; $$;

REVOKE ALL ON FUNCTION public.handle_material_review() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_applications_material ON public.applications;
CREATE TRIGGER trg_applications_material
BEFORE UPDATE ON public.applications
FOR EACH ROW EXECUTE FUNCTION public.handle_material_review();

CREATE OR REPLACE FUNCTION public.track_delivery_stage() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.caption_status = 'approved' AND NEW.media_status = 'approved' THEN
    IF NEW.merchant_review_status = 'draft' THEN
      NEW.merchant_review_status := 'submitted';
    END IF;
  ELSIF NEW.merchant_review_status <> 'draft' THEN
    NEW.merchant_review_status := 'draft';
    NEW.merchant_reviewed_at := NULL;
    NEW.merchant_review_note := NULL;
    NEW.published_at := NULL;
  END IF;
  RETURN NEW;
END; $$;

REVOKE ALL ON FUNCTION public.track_delivery_stage() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_applications_zz_delivery_stage ON public.applications;
CREATE TRIGGER trg_applications_zz_delivery_stage
BEFORE UPDATE ON public.applications
FOR EACH ROW EXECUTE FUNCTION public.track_delivery_stage();

CREATE OR REPLACE FUNCTION public.guard_delivery_review() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF (NEW.merchant_review_status IS DISTINCT FROM OLD.merchant_review_status
      OR NEW.merchant_review_note IS DISTINCT FROM OLD.merchant_review_note
      OR NEW.merchant_reviewed_at IS DISTINCT FROM OLD.merchant_reviewed_at)
     AND NOT public.merchant_of_submission(NEW.id) THEN
    RAISE EXCEPTION '商家確稿僅限該案件的商家';
  END IF;

  IF NEW.published_at IS DISTINCT FROM OLD.published_at THEN
    IF NOT public.owns_submission(NEW.id) THEN
      RAISE EXCEPTION '發文時間僅限該筆交付的 Foodie 填寫';
    END IF;
    IF NEW.merchant_review_status <> 'approved' THEN
      RAISE EXCEPTION '商家尚未確稿，還不能發文';
    END IF;
  END IF;

  RETURN NEW;
END; $$;

REVOKE ALL ON FUNCTION public.guard_delivery_review() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_applications_delivery_guard ON public.applications;
CREATE TRIGGER trg_applications_delivery_guard
BEFORE UPDATE ON public.applications
FOR EACH ROW EXECUTE FUNCTION public.guard_delivery_review();

CREATE OR REPLACE FUNCTION public.guard_application_decision()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION '媒合審核結果僅限平台管理員變更';
  END IF;

  IF NEW.completed IS DISTINCT FROM OLD.completed AND NEW.creator_id <> auth.uid() THEN
    RAISE EXCEPTION '合作完成標記僅限平台管理員或該 Foodie 本人變更';
  END IF;

  RETURN NEW;
END; $$;

REVOKE ALL ON FUNCTION public.guard_application_decision() FROM PUBLIC, anon, authenticated;

CREATE TYPE public.subscription_plan_type AS ENUM ('basic', 'pro', 'enterprise');

CREATE TABLE public.merchant_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_type public.subscription_plan_type NOT NULL,
  status public.foodie_subscription_status NOT NULL DEFAULT 'inactive',
  price numeric,
  monthly_case_limit integer,
  payment_status text NOT NULL DEFAULT 'demo_paid',
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX merchant_subscriptions_merchant_id_created_at_idx
  ON public.merchant_subscriptions (merchant_id, created_at DESC);

GRANT SELECT, INSERT ON public.merchant_subscriptions TO authenticated;
GRANT ALL ON public.merchant_subscriptions TO service_role;
ALTER TABLE public.merchant_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "merchant_subscriptions_select_own" ON public.merchant_subscriptions
FOR SELECT TO authenticated
USING (merchant_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "merchant_subscriptions_insert_own" ON public.merchant_subscriptions
FOR INSERT TO authenticated
WITH CHECK (merchant_id = auth.uid());

CREATE TRIGGER trg_merchant_subscriptions_updated
BEFORE UPDATE ON public.merchant_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.merchant_subscriptions
  (merchant_id, plan_type, status, price, monthly_case_limit, payment_status, started_at)
SELECT
  mp.user_id,
  mp.foodie_plan::text::public.subscription_plan_type,
  'active',
  CASE mp.foodie_plan WHEN 'basic' THEN 750 WHEN 'pro' THEN 1999 ELSE NULL END,
  CASE mp.foodie_plan WHEN 'basic' THEN 5 WHEN 'pro' THEN 15 ELSE NULL END,
  'demo_paid',
  mp.updated_at
FROM public.merchant_profiles mp
WHERE mp.foodie_subscription_status = 'active' AND mp.foodie_plan IS NOT NULL;

CREATE OR REPLACE FUNCTION public.merchant_is_blacklisted(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.merchant_profiles
    WHERE user_id = _user_id AND blacklisted
  );
$$;

REVOKE ALL ON FUNCTION public.merchant_is_blacklisted(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merchant_is_blacklisted(uuid) TO authenticated;

DROP POLICY IF EXISTS "campaigns_merchant_insert" ON public.campaigns;
CREATE POLICY "campaigns_merchant_insert" ON public.campaigns FOR INSERT TO authenticated
  WITH CHECK (
    merchant_id = auth.uid()
    AND public.has_role(auth.uid(), 'merchant')
    AND NOT public.merchant_is_blacklisted(auth.uid())
  );

DROP POLICY IF EXISTS "campaigns_merchant_update" ON public.campaigns;
CREATE POLICY "campaigns_merchant_update" ON public.campaigns FOR UPDATE TO authenticated
  USING (merchant_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR (
      merchant_id = auth.uid()
      AND (status <> 'published' OR NOT public.merchant_is_blacklisted(auth.uid()))
    )
  );

DROP POLICY IF EXISTS "applications_update" ON public.applications;
CREATE POLICY "applications_update" ON public.applications
FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND c.merchant_id = auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND c.merchant_id = auth.uid())
);

DROP POLICY IF EXISTS "applications_creator_update" ON public.applications;
CREATE POLICY "applications_creator_update" ON public.applications
FOR UPDATE TO authenticated
USING (creator_id = auth.uid())
WITH CHECK (creator_id = auth.uid());

DROP POLICY IF EXISTS "submission_photos_public_read" ON storage.objects;
CREATE POLICY "submission_photos_public_read" ON storage.objects
FOR SELECT TO anon, authenticated
USING (bucket_id = 'submission-photos');

DROP POLICY IF EXISTS "submission_photos_owner_insert" ON storage.objects;
CREATE POLICY "submission_photos_owner_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'submission-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "submission_photos_owner_update" ON storage.objects;
CREATE POLICY "submission_photos_owner_update" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'submission-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "submission_photos_owner_delete" ON storage.objects;
CREATE POLICY "submission_photos_owner_delete" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'submission-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "campaign_materials_auth_read" ON storage.objects;
CREATE POLICY "campaign_materials_auth_read" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'campaign-materials');

DROP POLICY IF EXISTS "campaign_materials_owner_insert" ON storage.objects;
CREATE POLICY "campaign_materials_owner_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'campaign-materials' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "campaign_materials_owner_delete" ON storage.objects;
CREATE POLICY "campaign_materials_owner_delete" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'campaign-materials' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "campaign_photos_merchant_insert" ON storage.objects;
DROP POLICY IF EXISTS "campaign_photos_merchant_delete" ON storage.objects;
DROP POLICY IF EXISTS "campaign_photos_owner_insert" ON storage.objects;
CREATE POLICY "campaign_photos_owner_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'campaign-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "campaign_photos_owner_update" ON storage.objects;
CREATE POLICY "campaign_photos_owner_update" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'campaign-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "campaign_photos_owner_delete" ON storage.objects;
CREATE POLICY "campaign_photos_owner_delete" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'campaign-photos' AND (storage.foldername(name))[1] = auth.uid()::text);