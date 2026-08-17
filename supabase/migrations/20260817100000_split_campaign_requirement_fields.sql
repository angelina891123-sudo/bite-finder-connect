-- Splits the single video_requirements / copy_requirements fields (added in
-- 20260817090000, never populated by a real merchant yet) into the more
-- granular sub-fields the merchant form now collects.
ALTER TABLE public.campaigns
  DROP COLUMN IF EXISTS video_requirements,
  DROP COLUMN IF EXISTS copy_requirements,
  ADD COLUMN IF NOT EXISTS video_direction text,
  ADD COLUMN IF NOT EXISTS video_must_include text,
  ADD COLUMN IF NOT EXISTS video_must_avoid text,
  ADD COLUMN IF NOT EXISTS copy_must_include text,
  ADD COLUMN IF NOT EXISTS copy_must_avoid text,
  ADD COLUMN IF NOT EXISTS hashtags text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS reference_link text;
