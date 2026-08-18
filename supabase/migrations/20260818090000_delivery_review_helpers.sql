-- guard_delivery_review()（trg_applications_delivery_guard，遠端已存在但不在任何
-- migration 裡）呼叫了 public.merchant_of_submission() 與 public.owns_submission()，
-- 但這兩個 function 從未被建立。結果是：只要不是 admin，任何嘗試更新
-- merchant_review_status / merchant_review_note / merchant_reviewed_at / published_at
-- 的操作都會直接噴出「function ... does not exist」的 Postgres 錯誤——商家無法確稿、
-- Foodie 也無法標記發文時間。這裡補上這兩個 helper function。

CREATE OR REPLACE FUNCTION public.owns_submission(_application_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.applications a
    WHERE a.id = _application_id AND a.creator_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.merchant_of_submission(_application_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.applications a
    JOIN public.campaigns c ON c.id = a.campaign_id
    WHERE a.id = _application_id AND c.merchant_id = auth.uid()
  )
$$;

REVOKE ALL ON FUNCTION public.owns_submission(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.merchant_of_submission(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owns_submission(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.merchant_of_submission(uuid) TO authenticated;
