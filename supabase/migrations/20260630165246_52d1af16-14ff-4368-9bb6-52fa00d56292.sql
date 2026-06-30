ALTER TABLE public.compromissos
  ADD COLUMN IF NOT EXISTS tags_rapidas jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS tarefas jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.profissionais
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS bio text;