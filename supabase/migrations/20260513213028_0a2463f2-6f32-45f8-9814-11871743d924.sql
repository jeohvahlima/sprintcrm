ALTER TABLE public.pre_sdr_analyses REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pre_sdr_analyses;