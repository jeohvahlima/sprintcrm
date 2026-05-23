ALTER TABLE public.hunter_pipeline_leads
  ADD CONSTRAINT hunter_pipeline_leads_lead_id_fkey
  FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;