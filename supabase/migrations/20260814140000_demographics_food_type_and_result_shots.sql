-- 1) Foodie 基本資料新增性別與年齡（註冊時填寫，可於個人資料管理修改）。
ALTER TABLE public.foodie_profiles
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS age integer;

-- 2) 案件新增食物類型，供前台篩選使用。既有案件為 NULL，只會出現在「全部」。
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS food_type text;

-- 3) Foodie 完成合作後上傳的成效截圖（觸及、互動等後台數據）。
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS result_images text[] NOT NULL DEFAULT '{}'::text[];

-- 4) 成效截圖的儲存空間。沿用 campaign-photos 的存取模式：
--    私有 bucket，路徑第一層為上傳者的 user id，前端以簽名網址讀取。
INSERT INTO storage.buckets (id, name, public)
VALUES ('performance-shots', 'performance-shots', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "performance_shots_auth_read" ON storage.objects;
CREATE POLICY "performance_shots_auth_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'performance-shots');

DROP POLICY IF EXISTS "performance_shots_owner_insert" ON storage.objects;
CREATE POLICY "performance_shots_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'performance-shots' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "performance_shots_owner_update" ON storage.objects;
CREATE POLICY "performance_shots_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'performance-shots' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "performance_shots_owner_delete" ON storage.objects;
CREATE POLICY "performance_shots_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'performance-shots' AND (storage.foldername(name))[1] = auth.uid()::text);
