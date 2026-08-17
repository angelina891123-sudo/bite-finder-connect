-- 營運後台第二階段：商家方案別、媒合審核權限收回平台管理員。

-- 1. 商家方案別
-- 刻意用可自由填寫的 text 而非 enum：方案名稱由營運端決定，
-- 之後調整方案不需要再改資料庫結構。NULL 代表尚未設定。
ALTER TABLE public.merchant_profiles ADD COLUMN IF NOT EXISTS plan text;
COMMENT ON COLUMN public.merchant_profiles.plan IS '商家方案別，例如 基本／進階／旗艦；NULL 為未設定';

CREATE INDEX IF NOT EXISTS idx_merchant_profiles_plan ON public.merchant_profiles(plan);

-- 2. 媒合審核權限收回平台管理員
-- 原本的規則允許「平台管理員 或 案件所屬商家」更新申請，商家因此能自行核准。
DROP POLICY IF EXISTS "applications_update" ON public.applications;
CREATE POLICY "applications_update" ON public.applications FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. 補上 Foodie 自我核准的漏洞
-- applications_creator_update 允許 Foodie 更新自己的申請（用於修改申請訊息），
-- 但 RLS 的 WITH CHECK 無法比較變更前後的值，所以擋不住他把 status 改成 approved。
-- 這裡用觸發器在資料庫層阻止非管理員變更審核結果與完成狀態。
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
