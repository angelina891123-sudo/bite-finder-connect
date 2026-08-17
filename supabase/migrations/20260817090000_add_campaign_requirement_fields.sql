-- Splits the old single "案件說明" free-text field into two purpose-specific
-- fields the merchant form now collects separately, plus an optional notes field.
-- The old `description` column is kept (nullable, already was) so existing
-- campaigns don't lose their text; the app falls back to it when
-- copy_requirements is empty.
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS video_requirements text,
  ADD COLUMN IF NOT EXISTS copy_requirements text,
  ADD COLUMN IF NOT EXISTS notes text;
