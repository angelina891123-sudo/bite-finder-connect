-- 訂閱資料的實際來源是 merchant_subscriptions（在 Supabase 後台直接新增，
-- 尚未進任何分支的 migration）。營運後台需要跨商家讀取，因此補一條管理員讀取規則。
--
-- 只新增 SELECT 規則，不動同事既有的任何 policy：商家自己讀寫訂閱的權限維持原樣。

ALTER TABLE public.merchant_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "merchant_subscriptions_admin_read" ON public.merchant_subscriptions;
CREATE POLICY "merchant_subscriptions_admin_read" ON public.merchant_subscriptions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
