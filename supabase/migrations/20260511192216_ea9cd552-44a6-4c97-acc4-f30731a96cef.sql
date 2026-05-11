-- Remove legacy rows without user (they were company-wide)
DELETE FROM public.prospeccao_smart_routines WHERE user_id IS NULL;

ALTER TABLE public.prospeccao_smart_routines
  ALTER COLUMN user_id SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'prospeccao_smart_routines_company_id_key'
      AND conrelid = 'public.prospeccao_smart_routines'::regclass
  ) THEN
    ALTER TABLE public.prospeccao_smart_routines
      DROP CONSTRAINT prospeccao_smart_routines_company_id_key;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'prospeccao_smart_routines_company_user_key'
      AND conrelid = 'public.prospeccao_smart_routines'::regclass
  ) THEN
    ALTER TABLE public.prospeccao_smart_routines
      ADD CONSTRAINT prospeccao_smart_routines_company_user_key
      UNIQUE (company_id, user_id);
  END IF;
END$$;