-- guard_material_review()（trg_applications_material_guard，遠端已存在但不在任何
-- migration 裡）擋非管理員變更 caption_reviewed_at / media_reviewed_at 時，沒有
-- 考慮到 track_material_caption_history() 這個 sibling trigger 本來就會在 Foodie
-- 修改 material_caption / material_media 時，把對應的 xxx_reviewed_at 自動清成
-- NULL（讓退件重送的素材回到未審核狀態）。因為 trigger 依名稱字母順序執行，
-- trg_applications_caption_history 比 trg_applications_material_guard 先跑，
-- 所以 guard_material_review() 看到的 NEW.xxx_reviewed_at 已經被改成 NULL，
-- 判斷成「非管理員試圖變更確稿時間」而擋下，導致 Foodie 完全無法重新送審。
--
-- 修正：只擋「非管理員把 xxx_reviewed_at 設成非 NULL 的值」（偽造審核時間），
-- 允許它被清成 NULL（重送素材的正常副作用）。
CREATE OR REPLACE FUNCTION public.guard_material_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
