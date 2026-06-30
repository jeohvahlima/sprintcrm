
CREATE OR REPLACE FUNCTION public.save_public_compromisso_meta(
  p_agenda_id uuid,
  p_compromisso_id uuid,
  p_notes text DEFAULT NULL,
  p_tags jsonb DEFAULT NULL,
  p_tasks jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exists boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM compromissos
     WHERE id = p_compromisso_id AND agenda_id = p_agenda_id
  ) INTO v_exists;
  IF NOT v_exists THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  UPDATE compromissos
     SET observacoes  = COALESCE(p_notes, observacoes),
         tags_rapidas = COALESCE(p_tags,  tags_rapidas),
         tarefas      = COALESCE(p_tasks, tarefas),
         updated_at   = now()
   WHERE id = p_compromisso_id AND agenda_id = p_agenda_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_public_compromisso_meta(uuid, uuid, text, jsonb, jsonb) TO anon, authenticated;
