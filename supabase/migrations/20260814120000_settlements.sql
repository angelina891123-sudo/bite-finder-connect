-- 結算 / 對帳：供第三方營運後台（/console）記錄每筆合作的費用與付款狀態。
-- 現有資料表沒有任何金額欄位，因此新增獨立的 settlements 表，不更動既有結構。

CREATE TYPE public.settlement_status AS ENUM ('pending','invoiced','paid','void');

CREATE TABLE public.settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period text NOT NULL,                             -- 對帳期間，格式 YYYY-MM
  amount numeric(12,2) NOT NULL DEFAULT 0,          -- 合作金額
  platform_fee numeric(12,2) NOT NULL DEFAULT 0,    -- 平台服務費
  currency text NOT NULL DEFAULT 'TWD',
  status public.settlement_status NOT NULL DEFAULT 'pending',
  note text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (application_id)                           -- 一筆合作只會有一筆結算
);

CREATE INDEX idx_settlements_period ON public.settlements(period);
CREATE INDEX idx_settlements_merchant ON public.settlements(merchant_id);
CREATE INDEX idx_settlements_status ON public.settlements(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.settlements TO authenticated;
GRANT ALL ON public.settlements TO service_role;
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;

-- 平台管理員可完整讀寫；商家僅能讀取自己的結算紀錄，不能修改。
CREATE POLICY "settlements_select" ON public.settlements FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR merchant_id = auth.uid());
CREATE POLICY "settlements_admin_insert" ON public.settlements FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "settlements_admin_update" ON public.settlements FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "settlements_admin_delete" ON public.settlements FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_settlements_updated BEFORE UPDATE ON public.settlements
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
