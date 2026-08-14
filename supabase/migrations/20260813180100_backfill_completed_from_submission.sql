-- 已交付成果連結的案件視為已完成。
-- 新的上傳行為由前端寫入 completed，此處補齊在該規則之前既有的資料。

UPDATE public.applications
SET completed = true,
    completed_at = COALESCE(completed_at, submitted_at, now())
WHERE submission_url IS NOT NULL
  AND completed = false;
