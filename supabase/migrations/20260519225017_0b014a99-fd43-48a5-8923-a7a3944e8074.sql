
ALTER TABLE public.compromissos
  ADD COLUMN IF NOT EXISTS confirmation_token uuid UNIQUE DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS status_confirmacao text NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS confirmado_em timestamptz,
  ADD COLUMN IF NOT EXISTS confirmado_via text;

UPDATE public.compromissos SET confirmation_token = gen_random_uuid() WHERE confirmation_token IS NULL;

CREATE INDEX IF NOT EXISTS idx_compromissos_confirmation_token ON public.compromissos(confirmation_token);
CREATE INDEX IF NOT EXISTS idx_compromissos_status_confirmacao ON public.compromissos(status_confirmacao);

CREATE OR REPLACE FUNCTION public.get_compromisso_by_token(_token uuid)
RETURNS TABLE (
  id uuid,
  data_hora_inicio timestamptz,
  data_hora_fim timestamptz,
  tipo_servico text,
  titulo text,
  observacoes text,
  status_confirmacao text,
  paciente text,
  profissional_nome text,
  empresa_nome text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.data_hora_inicio,
    c.data_hora_fim,
    c.tipo_servico,
    c.titulo,
    c.observacoes,
    c.status_confirmacao,
    COALESCE(c.paciente, l.name, '') AS paciente,
    COALESCE(p.nome, '') AS profissional_nome,
    COALESCE(comp.name, '') AS empresa_nome
  FROM public.compromissos c
  LEFT JOIN public.leads l ON l.id = c.lead_id
  LEFT JOIN public.profissionais p ON p.id = c.profissional_id
  LEFT JOIN public.companies comp ON comp.id = c.company_id
  WHERE c.confirmation_token = _token
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_compromisso_by_token(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.confirmar_compromisso_by_token(_token uuid, _acao text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_compromisso public.compromissos%ROWTYPE;
  v_novo_status text;
BEGIN
  IF _acao NOT IN ('confirmar', 'recusar') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ação inválida');
  END IF;

  SELECT * INTO v_compromisso FROM public.compromissos WHERE confirmation_token = _token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Compromisso não encontrado');
  END IF;

  v_novo_status := CASE WHEN _acao = 'confirmar' THEN 'confirmado' ELSE 'recusado' END;

  UPDATE public.compromissos
  SET status_confirmacao = v_novo_status,
      confirmado_em = now(),
      confirmado_via = 'link_publico',
      status = CASE WHEN _acao = 'confirmar' THEN 'confirmado' ELSE status END,
      updated_at = now()
  WHERE id = v_compromisso.id;

  IF _acao = 'confirmar' THEN
    UPDATE public.lembretes
    SET ativo = false, status_envio = 'cancelado'
    WHERE compromisso_id = v_compromisso.id
      AND status_envio = 'pendente';
  END IF;

  RETURN jsonb_build_object('success', true, 'status', v_novo_status);
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirmar_compromisso_by_token(uuid, text) TO anon, authenticated;
