
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('capture-page-assets', 'capture-page-assets', true, 20971520, ARRAY['image/png','image/jpeg','image/jpg','image/webp','image/gif','image/svg+xml','video/mp4','video/webm','video/quicktime'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 20971520, allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "Public read capture-page-assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'capture-page-assets');

CREATE POLICY "Authenticated upload capture-page-assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'capture-page-assets');

CREATE POLICY "Authenticated update capture-page-assets"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'capture-page-assets');

CREATE POLICY "Authenticated delete capture-page-assets"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'capture-page-assets');
