-- Suporte a templates de equipe nas rotinas inteligentes
ALTER TABLE public.prospeccao_smart_routines
  ADD COLUMN IF NOT EXISTS is_template boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS template_role text NULL;

-- Remover unique antiga (company_id, user_id) para permitir registros de template separados
ALTER TABLE public.prospeccao_smart_routines
  DROP CONSTRAINT IF EXISTS prospeccao_smart_routines_company_id_user_id_key;

-- Unique parcial: cada usuário tem 1 rotina pessoal por empresa
CREATE UNIQUE INDEX IF NOT EXISTS prospeccao_smart_routines_personal_uidx
  ON public.prospeccao_smart_routines (company_id, user_id)
  WHERE is_template = false;

-- Unique parcial: cada empresa tem 1 template por papel (sdr/closer)
CREATE UNIQUE INDEX IF NOT EXISTS prospeccao_smart_routines_template_uidx
  ON public.prospeccao_smart_routines (company_id, template_role)
  WHERE is_template = true;

-- Validação básica do template_role
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'prospeccao_smart_routines_template_role_chk'
  ) THEN
    ALTER TABLE public.prospeccao_smart_routines
      ADD CONSTRAINT prospeccao_smart_routines_template_role_chk
      CHECK (
        (is_template = false AND template_role IS NULL)
        OR (is_template = true AND template_role IN ('sdr','closer'))
      );
  END IF;
END $$;