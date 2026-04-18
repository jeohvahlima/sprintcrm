CREATE OR REPLACE FUNCTION public.update_capture_page_config(_company_id uuid, _config jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _updated jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.company_id = _company_id
    )
  ) THEN
    RAISE EXCEPTION 'Not allowed to update this company capture page';
  END IF;

  UPDATE public.companies
  SET capture_page_config = _config,
      updated_at = now()
  WHERE id = _company_id
  RETURNING capture_page_config INTO _updated;

  IF _updated IS NULL THEN
    RAISE EXCEPTION 'Company not found';
  END IF;

  RETURN _updated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_capture_page_config(uuid, jsonb) TO authenticated;