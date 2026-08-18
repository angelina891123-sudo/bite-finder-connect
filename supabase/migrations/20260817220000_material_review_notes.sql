-- 退回修改必須說明原因，因此需要欄位存放退件理由。
-- 文案與照片各自有退回動作，所以分開記錄。

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS caption_review_note text,
  ADD COLUMN IF NOT EXISTS media_review_note text;

COMMENT ON COLUMN public.applications.caption_review_note IS '文案退回修改的原因說明，由平台管理員填寫';
COMMENT ON COLUMN public.applications.media_review_note IS '照片退回修改的原因說明，由平台管理員填寫';

-- 重新提交後原因已無意義，一併清空，避免 Foodie 看到過期的退件理由。
CREATE OR REPLACE FUNCTION public.track_material_caption_history() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.material_caption IS DISTINCT FROM OLD.material_caption THEN
    NEW.material_caption_prev := OLD.material_caption;

    -- 由管理員自己改寫文案時不重設狀態，避免他一存檔就把自己的確稿清掉
    IF NOT public.has_role(auth.uid(), 'admin') THEN
      NEW.caption_status := 'submitted';
      NEW.caption_reviewed_at := NULL;
      NEW.caption_review_note := NULL;
    END IF;
  END IF;

  -- 照片清單有變動同樣退回待確稿，並清掉已不存在的選用項
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

-- 退件原因與確稿一樣屬營運端決定，非管理員不得變更。
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

  -- 重新提交時由 track_material_caption_history 清空原因，屬正常流程；
  -- 這裡只擋非管理員「填入或改寫」退件原因。
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
