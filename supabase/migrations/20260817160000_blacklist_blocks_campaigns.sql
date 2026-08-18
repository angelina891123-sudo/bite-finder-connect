-- 黑名單商家不得再上架案件。
-- 在資料庫層擋下，而不是只靠前端隱藏按鈕：商家仍可直接呼叫 API，
-- 前端限制不構成防線。

CREATE OR REPLACE FUNCTION public.merchant_is_blacklisted(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.merchant_profiles
    WHERE user_id = _user_id AND blacklisted
  );
$$;

REVOKE ALL ON FUNCTION public.merchant_is_blacklisted(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merchant_is_blacklisted(uuid) TO authenticated;

-- 新增案件：黑名單商家一律不得建立
DROP POLICY IF EXISTS "campaigns_merchant_insert" ON public.campaigns;
CREATE POLICY "campaigns_merchant_insert" ON public.campaigns FOR INSERT TO authenticated
  WITH CHECK (
    merchant_id = auth.uid()
    AND public.has_role(auth.uid(), 'merchant')
    AND NOT public.merchant_is_blacklisted(auth.uid())
  );

-- 更新案件：黑名單商家仍可編輯草稿或下架，但不得把案件變成已上架，
-- 否則他只要把既有案件改回 published 就繞過了限制。
DROP POLICY IF EXISTS "campaigns_merchant_update" ON public.campaigns;
CREATE POLICY "campaigns_merchant_update" ON public.campaigns FOR UPDATE TO authenticated
  USING (merchant_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR (
      merchant_id = auth.uid()
      AND (status <> 'published' OR NOT public.merchant_is_blacklisted(auth.uid()))
    )
  );
