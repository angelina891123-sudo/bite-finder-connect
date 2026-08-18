-- 移除單數欄位 campaigns.food_type。
--
-- 這個欄位有兩個來源，兩個都已棄用：
-- 1) 資料庫上原本就存在、未被任何 migration 建立、也沒有程式碼在用的孤兒欄位
--    （見 20260817130000_add_campaign_food_types.sql 的註解）。
-- 2) 20260814140000_demographics_food_type_and_result_shots.sql 曾經嘗試
--    重新啟用這個欄位，供另一套（字串版）Food Type 分類使用；該用途已確認
--    改用 campaigns.food_types（陣列）+ primary_food_type，food_type 不再需要。
--
-- 用 IF EXISTS：不管欄位是否曾經存在，執行都安全。
ALTER TABLE public.campaigns
  DROP COLUMN IF EXISTS food_type;
