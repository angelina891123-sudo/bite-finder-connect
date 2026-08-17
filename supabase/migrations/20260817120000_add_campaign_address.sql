-- 案件新增地址欄位，供首頁顯示 Google 地圖位置給 Foodie 查看。
-- 與既有的 region（地區篩選用的縣市下拉選單）並存，address 為自由輸入的詳細地址。
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS address text;
