
CREATE OR REPLACE FUNCTION public.list_storage_objects(p_bucket text)
RETURNS TABLE(name text, size bigint, created_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, storage
AS $$
  SELECT o.name,
         COALESCE((o.metadata->>'size')::bigint, 0) AS size,
         o.created_at
  FROM storage.objects o
  WHERE o.bucket_id = p_bucket;
$$;

REVOKE ALL ON FUNCTION public.list_storage_objects(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_storage_objects(text) TO service_role;
