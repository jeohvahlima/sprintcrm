CREATE TABLE public.commercial_playbooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  is_global BOOLEAN NOT NULL DEFAULT false,
  parent_playbook_id UUID REFERENCES public.commercial_playbooks(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  segment TEXT NOT NULL DEFAULT 'geral',
  cover_emoji TEXT DEFAULT '📘',
  accent_color TEXT DEFAULT '#22C55E',
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  estimated_time TEXT,
  difficulty TEXT DEFAULT 'intermediario',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT playbook_scope_check CHECK (
    (is_global = true AND company_id IS NULL) OR
    (is_global = false AND company_id IS NOT NULL)
  )
);

CREATE INDEX idx_playbooks_company ON public.commercial_playbooks(company_id);
CREATE INDEX idx_playbooks_global ON public.commercial_playbooks(is_global) WHERE is_global = true;
CREATE INDEX idx_playbooks_segment ON public.commercial_playbooks(segment);
CREATE INDEX idx_playbooks_category ON public.commercial_playbooks(category);

ALTER TABLE public.commercial_playbooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Playbooks visíveis - global ou da empresa"
ON public.commercial_playbooks FOR SELECT
TO authenticated
USING (is_global = true OR company_id = public.get_my_company_id());

CREATE POLICY "Inserir playbooks - super admin global ou empresa"
ON public.commercial_playbooks FOR INSERT
TO authenticated
WITH CHECK (
  (is_global = true AND public.is_super_admin())
  OR (is_global = false AND company_id = public.get_my_company_id())
);

CREATE POLICY "Atualizar playbooks - super admin ou empresa"
ON public.commercial_playbooks FOR UPDATE
TO authenticated
USING (
  (is_global = true AND public.is_super_admin())
  OR (is_global = false AND company_id = public.get_my_company_id())
);

CREATE POLICY "Excluir playbooks - super admin ou empresa"
ON public.commercial_playbooks FOR DELETE
TO authenticated
USING (
  (is_global = true AND public.is_super_admin())
  OR (is_global = false AND company_id = public.get_my_company_id())
);

CREATE TRIGGER trg_playbooks_updated_at
BEFORE UPDATE ON public.commercial_playbooks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();