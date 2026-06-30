
CREATE OR REPLACE FUNCTION public.get_public_agenda_profissional(p_agenda_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agenda agendas%ROWTYPE;
  v_prof profissionais%ROWTYPE;
  v_compromissos jsonb;
BEGIN
  SELECT * INTO v_agenda FROM agendas WHERE id = p_agenda_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  SELECT * INTO v_prof FROM profissionais
   WHERE company_id = v_agenda.company_id AND user_id = v_agenda.responsavel_id
   LIMIT 1;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'titulo', c.titulo,
    'tipo_servico', c.tipo_servico,
    'paciente', c.paciente,
    'telefone', c.telefone,
    'observacoes', c.observacoes,
    'data_hora_inicio', c.data_hora_inicio,
    'data_hora_fim', c.data_hora_fim,
    'status', c.status,
    'status_confirmacao', c.status_confirmacao,
    'lembretes_config', c.lembretes_config,
    'tags_rapidas', c.tags_rapidas,
    'tarefas', c.tarefas,
    'duracao', c.duracao
  ) ORDER BY c.data_hora_inicio), '[]'::jsonb)
  INTO v_compromissos
  FROM compromissos c
  WHERE c.agenda_id = p_agenda_id;

  RETURN jsonb_build_object(
    'ok', true,
    'agenda', jsonb_build_object(
      'id', v_agenda.id,
      'nome', v_agenda.nome,
      'tipo', v_agenda.tipo,
      'slug', v_agenda.slug,
      'avatar_url', v_agenda.avatar_url,
      'bio', v_agenda.bio,
      'tempo_medio_servico', v_agenda.tempo_medio_servico,
      'capacidade_simultanea', v_agenda.capacidade_simultanea,
      'disponibilidade', v_agenda.disponibilidade,
      'status', v_agenda.status
    ),
    'profissional', CASE WHEN v_prof.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', v_prof.id,
      'nome', v_prof.nome,
      'email', v_prof.email,
      'telefone', v_prof.telefone,
      'especialidade', v_prof.especialidade,
      'avatar_url', v_prof.avatar_url,
      'bio', v_prof.bio,
      'valor_consulta', v_prof.valor_consulta,
      'duracao_consulta', v_prof.duracao_consulta
    ) END,
    'compromissos', v_compromissos
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_agenda_profissional(uuid) TO anon, authenticated;
