ALTER TABLE public.legal_processes
  ADD COLUMN IF NOT EXISTS audiencia_modalidade TEXT,
  ADD COLUMN IF NOT EXISTS audiencia_local TEXT,
  ADD COLUMN IF NOT EXISTS audiencia_sala TEXT,
  ADD COLUMN IF NOT EXISTS audiencia_link TEXT,
  ADD COLUMN IF NOT EXISTS audiencia_observacoes TEXT,
  ADD COLUMN IF NOT EXISTS juiz TEXT,
  ADD COLUMN IF NOT EXISTS forum_tribunal TEXT,
  ADD COLUMN IF NOT EXISTS advogado_adversario TEXT,
  ADD COLUMN IF NOT EXISTS oab_adversario TEXT;

CREATE TABLE IF NOT EXISTS public.legal_process_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_process_id UUID NOT NULL REFERENCES public.legal_processes(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  uploaded_by UUID,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  document_type TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legal_process_documents_process
  ON public.legal_process_documents(legal_process_id);
CREATE INDEX IF NOT EXISTS idx_legal_process_documents_company
  ON public.legal_process_documents(company_id);

ALTER TABLE public.legal_process_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lpd_select_company" ON public.legal_process_documents;
CREATE POLICY "lpd_select_company" ON public.legal_process_documents
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT public.get_user_company_ids()));

DROP POLICY IF EXISTS "lpd_insert_company" ON public.legal_process_documents;
CREATE POLICY "lpd_insert_company" ON public.legal_process_documents
  FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT public.get_user_company_ids()));

DROP POLICY IF EXISTS "lpd_update_company" ON public.legal_process_documents;
CREATE POLICY "lpd_update_company" ON public.legal_process_documents
  FOR UPDATE TO authenticated
  USING (company_id IN (SELECT public.get_user_company_ids()));

DROP POLICY IF EXISTS "lpd_delete_company" ON public.legal_process_documents;
CREATE POLICY "lpd_delete_company" ON public.legal_process_documents
  FOR DELETE TO authenticated
  USING (company_id IN (SELECT public.get_user_company_ids()));

INSERT INTO storage.buckets (id, name, public)
VALUES ('legal-documents', 'legal-documents', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "legal_docs_select" ON storage.objects;
CREATE POLICY "legal_docs_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'legal-documents'
    AND ((storage.foldername(name))[1])::uuid IN (SELECT public.get_user_company_ids())
  );

DROP POLICY IF EXISTS "legal_docs_insert" ON storage.objects;
CREATE POLICY "legal_docs_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'legal-documents'
    AND ((storage.foldername(name))[1])::uuid IN (SELECT public.get_user_company_ids())
  );

DROP POLICY IF EXISTS "legal_docs_delete" ON storage.objects;
CREATE POLICY "legal_docs_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'legal-documents'
    AND ((storage.foldername(name))[1])::uuid IN (SELECT public.get_user_company_ids())
  );