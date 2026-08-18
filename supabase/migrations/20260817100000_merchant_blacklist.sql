-- 商家黑名單：營運後台可將商家列入黑名單並記錄原因。
-- 與 verification_status 分開：那是註冊資格審核，黑名單是營運端的停權判斷，
-- 兩者可能同時存在（例如資格已通過但後來因違規被列入黑名單）。

ALTER TABLE public.merchant_profiles
  ADD COLUMN IF NOT EXISTS blacklisted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS blacklist_reason text,
  ADD COLUMN IF NOT EXISTS blacklisted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_merchant_profiles_blacklisted
  ON public.merchant_profiles(blacklisted)
  WHERE blacklisted;

-- merchant_profiles_update_own 允許商家更新自己的資料，因此商家能自行把
-- blacklisted 改回 false。RLS 的 WITH CHECK 無法比較變更前後的值，
-- 所以用觸發器在資料庫層限定只有平台管理員能變更黑名單欄位。
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
