REVOKE INSERT, UPDATE, DELETE ON public.process_pages FROM anon;
GRANT SELECT ON public.process_pages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.process_pages TO authenticated;
GRANT ALL ON public.process_pages TO service_role;