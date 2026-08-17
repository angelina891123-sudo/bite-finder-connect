-- campaigns.collab_type（單數 text）改為 collab_types（複數 text[]），
-- 讓一個案件可以指定多種合作方式。
--
-- 注意：這個變更是先直接在 Supabase Dashboard 上做的，沒有留下 migration，
-- 導致本檔之前的程式碼與資料庫對不上（查詢 collab_type 會回 42703）。
-- 這支 migration 是補記錄，讓 schema 能從 migration 重建。
-- 對已經套用過的資料庫（ydcfbinsrqpcrcxesrpz）執行不會有任何作用。

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'campaigns' AND column_name = 'collab_type'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'campaigns' AND column_name = 'collab_types'
  ) THEN
    ALTER TABLE public.campaigns ADD COLUMN collab_types text[] NOT NULL DEFAULT '{}'::text[];
    UPDATE public.campaigns
      SET collab_types = ARRAY[collab_type]
      WHERE collab_type IS NOT NULL AND collab_type <> '';
    ALTER TABLE public.campaigns DROP COLUMN collab_type;
  END IF;
END $$;
