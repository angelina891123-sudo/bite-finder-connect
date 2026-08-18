-- guard_application_decision()（trg_applications_decision_guard，遠端已存在但不在
-- 任何 migration 裡）擋非管理員變更 completed，但這與既有、更早的功能衝突：
-- Foodie 在「我的申請」上傳成果連結時（my-applications.tsx 的 saveUrl），本來就會
-- 一併把自己這筆申請標成 completed=true（連結即代表已完成交付）。這個 guard 一律
-- 擋下非管理員的 completed 變更，導致 Foodie 完全無法上傳成果連結。
--
-- 修正：允許該筆申請的 Foodie 本人變更自己的 completed（上傳/清空成果連結時），
-- 其他非管理員（例如商家）仍然不行；status 的審核結果維持原樣，僅限管理員。
CREATE OR REPLACE FUNCTION public.guard_application_decision()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION '媒合審核結果僅限平台管理員變更';
  END IF;

  IF NEW.completed IS DISTINCT FROM OLD.completed AND NEW.creator_id <> auth.uid() THEN
    RAISE EXCEPTION '合作完成標記僅限平台管理員或該 Foodie 本人變更';
  END IF;

  RETURN NEW;
END;
$$;
