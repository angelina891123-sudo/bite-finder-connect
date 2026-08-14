-- Foodie 註冊第二步新增的選填社群欄位：TikTok 與其他社群平台。
-- other_social_handle 讓 Foodie 自行填寫平台與帳號（例如「小紅書 @your_id」）。

ALTER TABLE public.foodie_profiles
  ADD COLUMN IF NOT EXISTS tiktok_handle text,
  ADD COLUMN IF NOT EXISTS tiktok_followers integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_social_handle text,
  ADD COLUMN IF NOT EXISTS other_social_followers integer NOT NULL DEFAULT 0;
