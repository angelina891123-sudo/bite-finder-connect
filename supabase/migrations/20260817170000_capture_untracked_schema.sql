-- 補齊過去直接在遠端 Supabase 修改、沒有對應 migration 檔案的既有功能。
-- 這些全部是目前 production 已經在用、運作正常的功能，這裡只是把現況
-- 寫成 migration，讓 repo 的 migration 歷史能重現目前的實際資料庫狀態，
-- 之後重建資料庫（例如換一個全新的 Supabase 專案）才不會漏掉。
-- 不變更任何現有行為。

-- =========================================================================
-- 1. 素材審核：Foodie 上傳成果素材 → 平台管理員初審 → 商家複審。
-- =========================================================================
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS result_images text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS material_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS material_caption text,
  ADD COLUMN IF NOT EXISTS material_media text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS material_note text,
  ADD COLUMN IF NOT EXISTS material_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS material_reviewed_at timestamptz;

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
END;
$$;

REVOKE ALL ON FUNCTION public.handle_material_review() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_applications_material ON public.applications;
CREATE TRIGGER trg_applications_material
BEFORE UPDATE ON public.applications
FOR EACH ROW EXECUTE FUNCTION public.handle_material_review();

-- =========================================================================
-- 2. 媒合審核結果（status／completed）只能由平台管理員變更，對應 app 端
--    已經把核准／拒絕／標記完成的操作移到 admin 後台。
-- =========================================================================
CREATE OR REPLACE FUNCTION public.guard_application_decision()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
END;
$$;

REVOKE ALL ON FUNCTION public.guard_application_decision() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_applications_decision_guard ON public.applications;
CREATE TRIGGER trg_applications_decision_guard
BEFORE UPDATE ON public.applications
FOR EACH ROW EXECUTE FUNCTION public.guard_application_decision();

-- =========================================================================
-- 3. Foodie 需要能更新自己申請那一列（成果連結／素材送審等），
--    applications_update 目前限定商家／管理員，這裡補一條給 creator。
-- =========================================================================
DROP POLICY IF EXISTS "applications_creator_update" ON public.applications;
CREATE POLICY "applications_creator_update" ON public.applications
FOR UPDATE TO authenticated
USING (creator_id = auth.uid())
WITH CHECK (creator_id = auth.uid());

-- 與 applications_read 的 admin 條件重複，但現況如此，一併補上避免遺漏。
DROP POLICY IF EXISTS "applications_admin_read" ON public.applications;
CREATE POLICY "applications_admin_read" ON public.applications
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- =========================================================================
-- 4. 上傳成果連結、合作成效、素材審核用的 storage bucket。
-- =========================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('submission-photos', 'submission-photos', true),
  ('performance-shots', 'performance-shots', false),
  ('campaign-materials', 'campaign-materials', false)
ON CONFLICT (id) DO NOTHING;

-- submission-photos：Foodie 上傳成果連結附圖，公開讀取（案件詳情頁需要顯示）。
DROP POLICY IF EXISTS "submission_photos_public_read" ON storage.objects;
CREATE POLICY "submission_photos_public_read" ON storage.objects
FOR SELECT TO public
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

-- performance-shots：合作成效頁面用，不公開，僅登入者可讀。
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

-- campaign-materials：素材審核流程內部使用，不公開，僅登入者可讀。
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

-- =========================================================================
-- 5. campaign-photos 的政策後來被直接改掉：原本 migration 建立的
--    campaign_photos_merchant_insert / campaign_photos_merchant_delete
--    被換成 campaign_photos_owner_insert / _delete，並新增了 _update。
--    這裡收斂成目前遠端實際在用的版本。campaign_photos_public_read 不變。
-- =========================================================================
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
