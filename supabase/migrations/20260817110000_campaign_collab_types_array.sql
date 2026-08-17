-- 合作類型改為可複選；欄位改名為複數以反映現在存的是陣列。
ALTER TABLE public.campaigns RENAME COLUMN collab_type TO collab_types;

ALTER TABLE public.campaigns
  ALTER COLUMN collab_types TYPE text[] USING ARRAY[collab_types]::text[];
