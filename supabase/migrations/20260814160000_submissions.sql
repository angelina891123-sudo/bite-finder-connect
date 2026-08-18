-- Foodie 案件交付內容：文案與照片的提交與確稿流程。
-- applications 只有單一個 submission_url，無法存放文案與多張照片，因此新增獨立資料表。

CREATE TYPE public.submission_status AS ENUM ('draft', 'submitted', 'revising', 'approved');

CREATE TABLE public.submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL UNIQUE REFERENCES public.applications(id) ON DELETE CASCADE,
  copy_text text,
  copy_text_prev text,                                    -- 上一版文案，供「比較差異」使用
  copy_status public.submission_status NOT NULL DEFAULT 'draft',
  copy_submitted_at timestamptz,
  copy_reviewed_at timestamptz,
  photo_status public.submission_status NOT NULL DEFAULT 'draft',
  photo_reviewed_at timestamptz,
  video_url text,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.submission_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  code text,                                              -- 素材編號，例如 B001
  url text NOT NULL,
  selected boolean NOT NULL DEFAULT false,                -- 是否為選用照片
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_submission_photos_submission ON public.submission_photos(submission_id);
CREATE INDEX idx_submissions_copy_status ON public.submissions(copy_status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.submissions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.submission_photos TO authenticated;
GRANT ALL ON public.submissions TO service_role;
GRANT ALL ON public.submission_photos TO service_role;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_photos ENABLE ROW LEVEL SECURITY;

-- 判斷目前使用者是否為該筆交付的 Foodie
CREATE OR REPLACE FUNCTION public.owns_submission(_application_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.applications a
    WHERE a.id = _application_id AND a.creator_id = auth.uid()
  );
$$;

-- 判斷目前使用者是否為該筆交付所屬案件的商家
CREATE OR REPLACE FUNCTION public.merchant_of_submission(_application_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.applications a
    JOIN public.campaigns c ON c.id = a.campaign_id
    WHERE a.id = _application_id AND c.merchant_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.owns_submission(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.merchant_of_submission(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owns_submission(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.merchant_of_submission(uuid) TO authenticated;

-- submissions：平台管理員全權；Foodie 可讀寫自己的；商家僅可讀取自己案件的
CREATE POLICY "submissions_select" ON public.submissions FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.owns_submission(application_id)
    OR public.merchant_of_submission(application_id)
  );
CREATE POLICY "submissions_insert" ON public.submissions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.owns_submission(application_id));
CREATE POLICY "submissions_update" ON public.submissions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.owns_submission(application_id))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.owns_submission(application_id));
CREATE POLICY "submissions_delete" ON public.submissions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 確稿僅限平台管理員。RLS 的 WITH CHECK 無法比較變更前後的值，因此用觸發器把關。
CREATE OR REPLACE FUNCTION public.guard_submission_approval() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.copy_status = 'approved' AND OLD.copy_status <> 'approved' THEN
    RAISE EXCEPTION '文案確稿僅限平台管理員';
  END IF;

  IF NEW.photo_status = 'approved' AND OLD.photo_status <> 'approved' THEN
    RAISE EXCEPTION '照片確稿僅限平台管理員';
  END IF;

  RETURN NEW;
END; $$;

REVOKE ALL ON FUNCTION public.guard_submission_approval() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_submissions_approval_guard
BEFORE UPDATE ON public.submissions
FOR EACH ROW EXECUTE FUNCTION public.guard_submission_approval();

-- submission_photos：Foodie 可新增與刪除自己的照片；「選用」屬審核動作，僅限平台管理員
CREATE POLICY "submission_photos_select" ON public.submission_photos FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.id = submission_id
        AND (
          public.has_role(auth.uid(), 'admin')
          OR public.owns_submission(s.application_id)
          OR public.merchant_of_submission(s.application_id)
        )
    )
  );
CREATE POLICY "submission_photos_insert" ON public.submission_photos FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.id = submission_id
        AND (public.has_role(auth.uid(), 'admin') OR public.owns_submission(s.application_id))
    )
  );
CREATE POLICY "submission_photos_update" ON public.submission_photos FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "submission_photos_delete" ON public.submission_photos FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.id = submission_id
        AND (public.has_role(auth.uid(), 'admin') OR public.owns_submission(s.application_id))
    )
  );

CREATE TRIGGER trg_submissions_updated BEFORE UPDATE ON public.submissions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_submission_photos_updated BEFORE UPDATE ON public.submission_photos
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 照片儲存空間。與既有的 campaign-photos 相同做法：公開讀取，寫入限本人資料夾。
INSERT INTO storage.buckets (id, name, public)
VALUES ('submission-photos', 'submission-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "submission_photos_public_read" ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'submission-photos');
CREATE POLICY "submission_photos_owner_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'submission-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "submission_photos_owner_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'submission-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "submission_photos_owner_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'submission-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
