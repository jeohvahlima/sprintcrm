
-- 1) Modules: scope flag
ALTER TABLE public.training_modules
  ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'company'
    CHECK (scope IN ('global', 'company'));

-- Existing modules created by master accounts default to global so we don't break current visibility
UPDATE public.training_modules tm
SET scope = 'global'
WHERE EXISTS (
  SELECT 1 FROM public.companies c
  WHERE c.id = tm.company_id AND c.is_master_account = true
);

-- 2) Lessons: support uploaded videos
ALTER TABLE public.training_lessons
  ADD COLUMN IF NOT EXISTS video_url TEXT,
  ADD COLUMN IF NOT EXISTS video_type TEXT NOT NULL DEFAULT 'youtube'
    CHECK (video_type IN ('youtube', 'upload'));

ALTER TABLE public.training_lessons
  ALTER COLUMN youtube_url DROP NOT NULL;

-- 3) Storage bucket for recorded trainings (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('training-videos', 'training-videos', false)
ON CONFLICT (id) DO NOTHING;

-- Policies: users can read videos of their company; admins/gestors can upload/manage
CREATE POLICY "Company users can read training videos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'training-videos'
  AND (storage.foldername(name))[1] IN (
    SELECT ur.company_id::text FROM public.user_roles ur WHERE ur.user_id = auth.uid()
    UNION
    SELECT c.parent_company_id::text FROM public.companies c
    WHERE c.id IN (SELECT ur.company_id FROM public.user_roles ur WHERE ur.user_id = auth.uid())
      AND c.parent_company_id IS NOT NULL
    UNION
    SELECT c.id::text FROM public.companies c WHERE c.is_master_account = true
  )
);

CREATE POLICY "Admins can upload training videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'training-videos'
  AND (storage.foldername(name))[1] IN (
    SELECT ur.company_id::text FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('super_admin','company_admin','gestor')
  )
);

CREATE POLICY "Admins can update training videos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'training-videos'
  AND (storage.foldername(name))[1] IN (
    SELECT ur.company_id::text FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('super_admin','company_admin','gestor')
  )
);

CREATE POLICY "Admins can delete training videos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'training-videos'
  AND (storage.foldername(name))[1] IN (
    SELECT ur.company_id::text FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('super_admin','company_admin','gestor')
  )
);
