-- Foodie 素材審核：上傳成果連結／成效截圖之前，必須先送出文案與圖片／影片素材，
-- 依序經平台管理員與商家兩階段審核通過。
--
-- 狀態流程：
--   draft            Foodie 編輯中，尚未送審
--   admin_pending    已送審，等待平台管理員
--   admin_rejected   管理員退件（附原因），Foodie 可修改後重送
--   merchant_pending 管理員通過，等待商家
--   merchant_rejected 商家退件（附原因），Foodie 可修改後重送
--   approved         商家通過，解鎖成果連結與成效截圖

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS material_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS material_caption text,
  ADD COLUMN IF NOT EXISTS material_media text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS material_note text,
  ADD COLUMN IF NOT EXISTS material_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS material_reviewed_at timestamptz;

-- 素材檔案（圖片與影片）。沿用既有做法：私有 bucket、路徑第一層為上傳者 id。
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('campaign-materials', 'campaign-materials', false, 104857600,
        ARRAY['image/png','image/jpeg','image/webp','image/gif','video/mp4','video/quicktime','video/webm'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "campaign_materials_auth_read" ON storage.objects;
CREATE POLICY "campaign_materials_auth_read" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'campaign-materials');

DROP POLICY IF EXISTS "campaign_materials_owner_insert" ON storage.objects;
CREATE POLICY "campaign_materials_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'campaign-materials' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "campaign_materials_owner_delete" ON storage.objects;
CREATE POLICY "campaign_materials_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'campaign-materials' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 狀態轉移的守門：避免 Foodie 自行把素材標記為通過。
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

  -- Foodie 只能送審（含退件後重送）。
  IF NEW.material_status = 'admin_pending' THEN
    IF NOT (is_creator OR is_admin) THEN
      RAISE EXCEPTION '只有該 Foodie 可以送出素材審核';
    END IF;
    IF OLD.material_status NOT IN ('draft', 'admin_rejected', 'merchant_rejected') THEN
      RAISE EXCEPTION '目前狀態無法送審';
    END IF;
    NEW.material_submitted_at := now();
    NEW.material_note := NULL;

  -- 第一關：平台管理員。
  ELSIF NEW.material_status IN ('merchant_pending', 'admin_rejected') THEN
    IF NOT is_admin THEN
      RAISE EXCEPTION '只有平台管理員可以進行第一階段審核';
    END IF;
    IF OLD.material_status <> 'admin_pending' THEN
      RAISE EXCEPTION '素材尚未送出管理員審核';
    END IF;
    NEW.material_reviewed_at := now();

  -- 第二關：商家。管理員退件的案件不會走到這裡。
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

  -- 退件必須附原因。
  IF NEW.material_status IN ('admin_rejected', 'merchant_rejected')
     AND coalesce(btrim(NEW.material_note), '') = '' THEN
    RAISE EXCEPTION '退件必須填寫原因';
  END IF;

  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.handle_material_review() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_applications_material ON public.applications;
CREATE TRIGGER trg_applications_material
BEFORE UPDATE ON public.applications
FOR EACH ROW EXECUTE FUNCTION public.handle_material_review();

-- 管理員需要能更新 applications 才能審核（既有 applications_update 已涵蓋 admin）。
-- 商家亦已由 applications_update 涵蓋，此處不需新增 policy。
