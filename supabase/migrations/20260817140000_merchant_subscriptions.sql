-- Foodie 媒合方案訂閱紀錄。取代 merchant_profiles.foodie_subscription_status /
-- foodie_plan 作為方案狀態的 single source of truth（那兩個欄位缺少
-- price／monthly_case_limit／payment_status／started_at 等資訊，不足以
-- 支撐案件額度管控與 Demo 付款紀錄，因此新增獨立的 table 而非沿用）。
--
-- 設計為 append-only：每次開通/續訂都是新的一列，不 UPDATE 舊列。要取得
-- 商家目前的方案，一律查「該 merchant 依 created_at 排序的最新一列」。
CREATE TYPE public.subscription_plan_type AS ENUM ('basic', 'pro', 'enterprise');

CREATE TABLE public.merchant_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_type public.subscription_plan_type NOT NULL,
  status public.foodie_subscription_status NOT NULL DEFAULT 'inactive',
  -- monthly price in NTD; NULL for enterprise（客製報價，未定案前不使用假數字）
  price numeric,
  -- NULL for enterprise（額度客製，未定案前不使用假數字）
  monthly_case_limit integer,
  -- 目前僅有 Demo 付款，一律為 'demo_paid'；保留欄位供未來串接真實金流時
  -- 區分 'paid'，避免無法回溯哪些紀錄只是 Demo。
  payment_status text NOT NULL DEFAULT 'demo_paid',
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX merchant_subscriptions_merchant_id_created_at_idx
  ON public.merchant_subscriptions (merchant_id, created_at DESC);

GRANT SELECT, INSERT ON public.merchant_subscriptions TO authenticated;
GRANT ALL ON public.merchant_subscriptions TO service_role;

ALTER TABLE public.merchant_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "merchant_subscriptions_select_own" ON public.merchant_subscriptions
FOR SELECT TO authenticated
USING (merchant_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "merchant_subscriptions_insert_own" ON public.merchant_subscriptions
FOR INSERT TO authenticated
WITH CHECK (merchant_id = auth.uid());

CREATE TRIGGER trg_merchant_subscriptions_updated
BEFORE UPDATE ON public.merchant_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Backfill：既有商家若已透過舊機制開通方案，補一筆對應紀錄，避免上線後
-- 看起來像是「方案被清空」。金額/額度依當時的方案代入本次確定的定價。
INSERT INTO public.merchant_subscriptions
  (merchant_id, plan_type, status, price, monthly_case_limit, payment_status, started_at)
SELECT
  mp.user_id,
  mp.foodie_plan::text::public.subscription_plan_type,
  'active',
  CASE mp.foodie_plan WHEN 'basic' THEN 750 WHEN 'pro' THEN 1999 ELSE NULL END,
  CASE mp.foodie_plan WHEN 'basic' THEN 5 WHEN 'pro' THEN 15 ELSE NULL END,
  'demo_paid',
  mp.updated_at
FROM public.merchant_profiles mp
WHERE mp.foodie_subscription_status = 'active' AND mp.foodie_plan IS NOT NULL;
