ALTER TABLE public.training_modules
  ADD COLUMN IF NOT EXISTS track TEXT NOT NULL DEFAULT 'plataforma'
  CHECK (track IN ('onboarding','sdr','closer','gestao','plataforma'));

UPDATE public.training_modules SET track = 'plataforma' WHERE track IS NULL;

CREATE INDEX IF NOT EXISTS training_modules_track_idx ON public.training_modules(track);