-- Foodie 內容審核改以 applications 的 material_caption / material_media 為單一資料來源。
--
-- 背景：material_caption（text）與 material_media（text[]）是在 Supabase 後台直接新增的，
-- 沒有進任何分支的 migration。這裡補上 IF NOT EXISTS 的定義，讓專案的 migration 能反映
-- 真實結構；若欄位已存在則不會有任何影響。
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS material_caption text,
  ADD COLUMN IF NOT EXISTS material_media text[] NOT NULL DEFAULT '{}';

-- 審核狀態：material_caption / material_media 只存內容，存不了確稿流程所需的狀態，
-- 因此在同一張表上補齊營運端需要的欄位，維持單一資料來源。
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS caption_status public.submission_status NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS media_status public.submission_status NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS caption_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS media_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS material_caption_prev text,
  ADD COLUMN IF NOT EXISTS selected_media text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.applications.material_caption_prev IS '上一版文案，由觸發器自動維護，供營運後台「比較差異」使用';
COMMENT ON COLUMN public.applications.selected_media IS '營運端挑選採用的照片網址，為 material_media 的子集';

CREATE INDEX IF NOT EXISTS idx_applications_caption_status ON public.applications(caption_status);
CREATE INDEX IF NOT EXISTS idx_applications_media_status ON public.applications(media_status);

-- 自動保留上一版文案。
-- 不論是 Foodie 從官網修改、或營運端在後台修改，都會正確留下前一版，
-- 前端不需要自己搬值。文案一有變動就退回「待確稿」，避免舊的確稿狀態被沿用。
CREATE OR REPLACE FUNCTION public.track_material_caption_history() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.material_caption IS DISTINCT FROM OLD.material_caption THEN
    NEW.material_caption_prev := OLD.material_caption;

    -- 由管理員自己改寫文案時不重設狀態，避免他一存檔就把自己的確稿清掉
    IF NOT public.has_role(auth.uid(), 'admin') THEN
      NEW.caption_status := 'submitted';
      NEW.caption_reviewed_at := NULL;
    END IF;
  END IF;

  -- 照片清單有變動同樣退回待確稿，並清掉已不存在的選用項
  IF NEW.material_media IS DISTINCT FROM OLD.material_media THEN
    IF NOT public.has_role(auth.uid(), 'admin') THEN
      NEW.media_status := 'submitted';
      NEW.media_reviewed_at := NULL;
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

-- 確稿與選用照片屬營運端決定，僅限平台管理員。
-- applications_creator_update 允許 Foodie 更新自己的申請（用於交付內容），
-- 但 RLS 的 WITH CHECK 無法比較變更前後的值，所以用觸發器把關。
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

  IF NEW.caption_reviewed_at IS DISTINCT FROM OLD.caption_reviewed_at
     OR NEW.media_reviewed_at IS DISTINCT FROM OLD.media_reviewed_at THEN
    RAISE EXCEPTION '確稿時間僅限平台管理員變更';
  END IF;

  -- 選用照片只有管理員能改；但觸發器自動剔除已刪除的照片不算變更意圖，
  -- 因此只在「新增了不在舊清單裡的項目」時擋下。
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

-- 移除先前另建的交付資料表：內容已統一存放於 applications，
-- 兩套並存會讓營運後台與官網看到的資料不一致。
DROP TABLE IF EXISTS public.submission_photos;
DROP TABLE IF EXISTS public.submissions;
DROP FUNCTION IF EXISTS public.guard_submission_approval();
DROP FUNCTION IF EXISTS public.owns_submission(uuid);
DROP FUNCTION IF EXISTS public.merchant_of_submission(uuid);
