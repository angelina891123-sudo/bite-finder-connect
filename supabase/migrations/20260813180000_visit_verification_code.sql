-- Foodie 到店核銷代碼
-- 案件核准（媒合成功）時自動產生 6 位數字代碼，Foodie 到店時出示給商家，
-- 商家於後台輸入代碼完成核銷。

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS visit_code text,
  ADD COLUMN IF NOT EXISTS visited boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS visited_at timestamptz;

-- 既有已核准案件補發代碼（需在建立 trigger 前執行，migration 沒有 auth.uid()）。
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

  -- 只有商家／管理員能核銷或變更代碼，避免 Foodie 自行標記到店。
  IF NEW.visited IS DISTINCT FROM OLD.visited AND NOT is_merchant THEN
    RAISE EXCEPTION '只有商家可以核銷到店代碼';
  END IF;
  IF NEW.visit_code IS DISTINCT FROM OLD.visit_code AND NOT is_merchant THEN
    RAISE EXCEPTION '不可自行變更到店代碼';
  END IF;

  -- 媒合成功（核准）時產生代碼。
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

CREATE TRIGGER trg_applications_visit
BEFORE UPDATE ON public.applications
FOR EACH ROW EXECUTE FUNCTION public.handle_application_visit();
