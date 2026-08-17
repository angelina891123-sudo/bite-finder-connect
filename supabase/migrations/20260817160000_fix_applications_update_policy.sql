-- 修正 applications_update RLS policy。
--
-- 現況（非 migration 產生，直接在遠端手動修改過）：這個 policy 被改成
-- USING/WITH CHECK 僅允許 has_role(auth.uid(),'admin')，導致商家完全無法
-- UPDATE 自己案件的任何一列 applications——包括核銷到店代碼所需的
-- visited / visit_code 欄位。商家在後台輸入代碼後 UI 顯示「到店成功」，
-- 但實際上 UPDATE 因 RLS 被判定為 0 rows affected（PostgREST 不會回傳
-- error），畫面刷新後又打回「尚未到店」，代碼可以重複輸入。
--
-- 「誰能核准案件／標記完成」已經由 guard_application_decision 這個
-- trigger 在欄位層級擋下（只有 admin 可以改 status / completed）；
-- 「誰能核銷到店代碼」則由 handle_application_visit trigger 擋下
-- （只有商家或 admin 可以改 visited / visit_code）。這一列本身該不該讓
-- 商家碰，本來就該回到原始設計：案件擁有者（商家）或 admin。
DROP POLICY IF EXISTS "applications_update" ON public.applications;

CREATE POLICY "applications_update" ON public.applications
FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND c.merchant_id = auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND c.merchant_id = auth.uid())
);
