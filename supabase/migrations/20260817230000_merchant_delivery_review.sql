-- 交付內容的三段審核流程：平台確稿 → 商家確稿 → Foodie 發文。
--
-- 沿用既有的 submission_status enum，語意對應如下：
--   draft     尚未輪到商家（平台還沒把文案與照片都確稿）
--   submitted 待商家確稿
--   revising  商家退回修改
--   approved  商家已確稿，Foodie 可以發文

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS merchant_review_status public.submission_status NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS merchant_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS merchant_review_note text,
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

COMMENT ON COLUMN public.applications.merchant_review_status IS
  '商家對交付內容的確稿狀態；平台把文案與照片都確稿後才會進入 submitted';
COMMENT ON COLUMN public.applications.published_at IS 'Foodie 實際發文時間，商家確稿後才可填寫';

CREATE INDEX IF NOT EXISTS idx_applications_merchant_review
  ON public.applications(merchant_review_status);

/**
 * 依平台的確稿結果推進或退回商家審核階段。
 * 觸發器命名刻意以 zz 開頭，讓它在同表其他 BEFORE UPDATE 觸發器之後才執行
 * （Postgres 對同時機的觸發器依名稱排序），確保讀到的是本次更新後的平台狀態。
 */
CREATE OR REPLACE FUNCTION public.track_delivery_stage() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.caption_status = 'approved' AND NEW.media_status = 'approved' THEN
    -- 平台兩項都確稿，交棒給商家
    IF NEW.merchant_review_status = 'draft' THEN
      NEW.merchant_review_status := 'submitted';
    END IF;
  ELSIF NEW.merchant_review_status <> 'draft' THEN
    -- 平台端任一項被退回或重新提交，商家階段一併重置，避免沿用舊的商家確稿
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

/**
 * 權限把關。
 * 商家確稿只能由該案件的商家或平台管理員操作；
 * 發文時間只有該筆交付的 Foodie 或平台管理員能填。
 */
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
