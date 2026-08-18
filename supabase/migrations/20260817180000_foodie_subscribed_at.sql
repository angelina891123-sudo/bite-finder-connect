-- 訂閱時間改用專屬欄位。
-- 原本營運後台顯示的是 updated_at，但那個欄位只要資料列被更新就會變動
-- （審核、列入黑名單都會），當成訂閱時間並不準確。

ALTER TABLE public.merchant_profiles
  ADD COLUMN IF NOT EXISTS foodie_subscribed_at timestamptz;

COMMENT ON COLUMN public.merchant_profiles.foodie_subscribed_at IS
  '訂閱生效時間，由觸發器在 foodie_subscription_status 轉為 active 時寫入';

-- 回填：已訂閱但沒有時間的，先以 updated_at 當近似值。
-- 這只是初始估算值，之後的訂閱都會由觸發器記錄準確時間。
UPDATE public.merchant_profiles
SET foodie_subscribed_at = updated_at
WHERE foodie_subscription_status = 'active'
  AND foodie_subscribed_at IS NULL;

-- 由資料庫記錄訂閱時間，商家後台（main 的程式碼）不需要任何改動。
CREATE OR REPLACE FUNCTION public.track_foodie_subscription() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.foodie_subscription_status = 'active'
     AND OLD.foodie_subscription_status IS DISTINCT FROM 'active' THEN
    NEW.foodie_subscribed_at := now();
  ELSIF NOT public.has_role(auth.uid(), 'admin') THEN
    -- 非管理員不得手動指定訂閱時間，只能由上面的狀態轉換自動產生
    NEW.foodie_subscribed_at := OLD.foodie_subscribed_at;
  END IF;

  RETURN NEW;
END; $$;

REVOKE ALL ON FUNCTION public.track_foodie_subscription() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_merchant_subscription_time ON public.merchant_profiles;
CREATE TRIGGER trg_merchant_subscription_time
BEFORE UPDATE ON public.merchant_profiles
FOR EACH ROW EXECUTE FUNCTION public.track_foodie_subscription();
