CREATE POLICY "Public read published pages"
ON public.process_pages
FOR SELECT
TO anon, authenticated
USING ((properties->>'status') = 'published');

CREATE POLICY "Public read blocks of published pages"
ON public.process_blocks
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.process_pages p
    WHERE p.id = process_blocks.page_id
      AND (p.properties->>'status') = 'published'
  )
);