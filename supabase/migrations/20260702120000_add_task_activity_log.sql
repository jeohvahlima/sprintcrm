-- Histórico de atividades por tarefa (usuários reais do CRM)
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS activity_log JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.tasks.activity_log IS 'Timeline de ações na tarefa: movimentações, comentários, checklist, etc.';
