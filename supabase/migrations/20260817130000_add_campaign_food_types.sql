-- Food Type 分類：商家建立/編輯案件時選擇（最多 3 個），第一個為 primary_food_type。
-- 舊案件允許維持空陣列/NULL，不強制補資料。
--
-- 注意：資料庫目前另外存在一個未被任何 migration 建立、且無程式碼使用的
-- 單數欄位 food_type（text），本次不處理它，僅新增下列獨立追蹤的欄位。
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS food_types text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS primary_food_type text;
