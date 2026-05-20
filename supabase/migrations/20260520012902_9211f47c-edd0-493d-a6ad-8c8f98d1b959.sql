
-- 1) Nova coluna para controlar reenvio de cobrança
ALTER TABLE public.compromissos
  ADD COLUMN IF NOT EXISTS cobranca_enviada_em timestamptz;

-- 2) Atualizar confirmar_compromisso_by_token: cancelar lembretes, notificar, postar no chat
CREATE OR REPLACE FUNCTION public.confirmar_compromisso_by_token(_token uuid, _acao text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_compromisso public.compromissos%ROWTYPE;
  v_novo_status text;
  v_lead_nome text;
  v_lead_telefone text;
  v_msg_sistema text;
  v_horario_fmt text;
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

  -- Cancela lembretes futuros se confirmado
  IF _acao = 'confirmar' THEN
    UPDATE public.lembretes
       SET status_envio = 'cancelado',
           ativo = false
     WHERE compromisso_id = v_compromisso.id
       AND status_envio IN ('pendente', 'retry')
       AND COALESCE(data_envio, data_hora_envio, now()) > now();
  END IF;

  -- Formata horário (timezone Brasil)
  v_horario_fmt := to_char(v_compromisso.data_hora_inicio AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI');

  -- Busca dados do lead
  IF v_compromisso.lead_id IS NOT NULL THEN
    SELECT name, COALESCE(phone, telefone) INTO v_lead_nome, v_lead_telefone
      FROM public.leads WHERE id = v_compromisso.lead_id;
  END IF;
  IF v_lead_nome IS NULL THEN v_lead_nome := COALESCE(v_compromisso.paciente, 'Lead'); END IF;
  IF v_lead_telefone IS NULL THEN v_lead_telefone := v_compromisso.telefone; END IF;

  -- Notificação no CRM
  IF v_compromisso.usuario_responsavel_id IS NOT NULL THEN
    INSERT INTO public.notificacoes (usuario_id, company_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
    VALUES (
      v_compromisso.usuario_responsavel_id,
      v_compromisso.company_id,
      CASE WHEN _acao = 'confirmar' THEN 'compromisso_confirmado' ELSE 'compromisso_recusado' END,
      CASE WHEN _acao = 'confirmar' THEN '✅ Agendamento confirmado' ELSE '❌ Agendamento recusado' END,
      v_lead_nome || ' ' || (CASE WHEN _acao = 'confirmar' THEN 'confirmou' ELSE 'recusou' END) || ' o agendamento de ' || v_horario_fmt || ' via link.',
      v_compromisso.id,
      'compromisso'
    );
  END IF;

  -- Mensagem-sistema no chat do lead
  IF v_lead_telefone IS NOT NULL AND v_compromisso.lead_id IS NOT NULL THEN
    v_msg_sistema := CASE
      WHEN _acao = 'confirmar' THEN '✅ *Cliente confirmou o agendamento via link* — ' || v_horario_fmt
      ELSE '❌ *Cliente recusou o agendamento via link* — ' || v_horario_fmt
    END;
    INSERT INTO public.conversas (numero, telefone_formatado, mensagem, origem, status, tipo_mensagem, lead_id, company_id, owner_id, fromme, sent_by, read, delivered)
    VALUES (
      v_lead_telefone, v_lead_telefone, v_msg_sistema, 'Sistema', 'Enviada', 'text',
      v_compromisso.lead_id, v_compromisso.company_id, v_compromisso.owner_id,
      true, 'sistema', true, true
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'status', v_novo_status);
END;
$function$;

-- 3) RPC pública: horários disponíveis
CREATE OR REPLACE FUNCTION public.get_horarios_disponiveis_by_token(
  _token uuid,
  _data_inicio date DEFAULT CURRENT_DATE,
  _dias integer DEFAULT 14
)
RETURNS TABLE (slot timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_compromisso public.compromissos%ROWTYPE;
  v_duracao integer;
  v_data date;
  v_hora_inicio integer := 8;   -- 08:00
  v_hora_fim integer := 18;     -- 18:00
  v_slot_min integer := 30;
  v_cursor timestamptz;
  v_slot_end timestamptz;
  v_fim timestamptz;
BEGIN
  SELECT * INTO v_compromisso FROM public.compromissos WHERE confirmation_token = _token;
  IF NOT FOUND THEN RETURN; END IF;

  v_duracao := COALESCE(v_compromisso.duracao, 30);

  FOR i IN 0.._dias-1 LOOP
    v_data := _data_inicio + i;
    -- pula domingo (0)
    IF extract(dow from v_data) = 0 THEN CONTINUE; END IF;

    v_cursor := (v_data + make_interval(hours => v_hora_inicio)) AT TIME ZONE 'America/Sao_Paulo';
    v_fim := (v_data + make_interval(hours => v_hora_fim)) AT TIME ZONE 'America/Sao_Paulo';

    WHILE v_cursor + make_interval(mins => v_duracao) <= v_fim LOOP
      v_slot_end := v_cursor + make_interval(mins => v_duracao);

      -- precisa ser no futuro (com 1h de antecedência mínima)
      IF v_cursor > now() + interval '1 hour' THEN
        -- verifica conflito com outros compromissos do mesmo profissional (ou empresa se não houver prof)
        IF NOT EXISTS (
          SELECT 1 FROM public.compromissos c
           WHERE c.id <> v_compromisso.id
             AND c.status NOT IN ('cancelado', 'recusado')
             AND (
               (v_compromisso.profissional_id IS NOT NULL AND c.profissional_id = v_compromisso.profissional_id)
               OR (v_compromisso.profissional_id IS NULL AND c.company_id = v_compromisso.company_id AND c.usuario_responsavel_id = v_compromisso.usuario_responsavel_id)
             )
             AND tstzrange(c.data_hora_inicio, c.data_hora_fim, '[)') && tstzrange(v_cursor, v_slot_end, '[)')
        ) THEN
          slot := v_cursor;
          RETURN NEXT;
        END IF;
      END IF;
      v_cursor := v_cursor + make_interval(mins => v_slot_min);
    END LOOP;
  END LOOP;
END;
$function$;

-- 4) RPC pública: reagendar pelo lead
CREATE OR REPLACE FUNCTION public.reagendar_compromisso_by_token(
  _token uuid,
  _nova_data timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_compromisso public.compromissos%ROWTYPE;
  v_duracao integer;
  v_nova_fim timestamptz;
  v_lead_nome text;
  v_lead_telefone text;
  v_horario_antigo text;
  v_horario_novo text;
BEGIN
  IF _nova_data IS NULL OR _nova_data < now() + interval '30 minutes' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Data inválida');
  END IF;

  SELECT * INTO v_compromisso FROM public.compromissos WHERE confirmation_token = _token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Compromisso não encontrado');
  END IF;

  v_duracao := COALESCE(v_compromisso.duracao, 30);
  v_nova_fim := _nova_data + make_interval(mins => v_duracao);

  -- Verifica conflito
  IF EXISTS (
    SELECT 1 FROM public.compromissos c
     WHERE c.id <> v_compromisso.id
       AND c.status NOT IN ('cancelado', 'recusado')
       AND (
         (v_compromisso.profissional_id IS NOT NULL AND c.profissional_id = v_compromisso.profissional_id)
         OR (v_compromisso.profissional_id IS NULL AND c.company_id = v_compromisso.company_id AND c.usuario_responsavel_id = v_compromisso.usuario_responsavel_id)
       )
       AND tstzrange(c.data_hora_inicio, c.data_hora_fim, '[)') && tstzrange(_nova_data, v_nova_fim, '[)')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Horário indisponível');
  END IF;

  v_horario_antigo := to_char(v_compromisso.data_hora_inicio AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI');
  v_horario_novo := to_char(_nova_data AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI');

  -- Atualiza compromisso
  UPDATE public.compromissos
     SET data_hora_inicio = _nova_data,
         data_hora_fim = v_nova_fim,
         status_confirmacao = 'confirmado',
         confirmado_em = now(),
         confirmado_via = 'link_reagendamento',
         status = 'confirmado',
         cobranca_enviada_em = NULL,
         lembrete_enviado = false,
         updated_at = now()
   WHERE id = v_compromisso.id;

  -- Cancela lembretes antigos
  UPDATE public.lembretes
     SET status_envio = 'cancelado', ativo = false
   WHERE compromisso_id = v_compromisso.id
     AND status_envio IN ('pendente', 'retry');

  -- Lead
  IF v_compromisso.lead_id IS NOT NULL THEN
    SELECT name, COALESCE(phone, telefone) INTO v_lead_nome, v_lead_telefone
      FROM public.leads WHERE id = v_compromisso.lead_id;
  END IF;
  IF v_lead_nome IS NULL THEN v_lead_nome := COALESCE(v_compromisso.paciente, 'Lead'); END IF;
  IF v_lead_telefone IS NULL THEN v_lead_telefone := v_compromisso.telefone; END IF;

  -- Notificação no CRM
  IF v_compromisso.usuario_responsavel_id IS NOT NULL THEN
    INSERT INTO public.notificacoes (usuario_id, company_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
    VALUES (
      v_compromisso.usuario_responsavel_id,
      v_compromisso.company_id,
      'compromisso_remarcado',
      '🔄 Agendamento remarcado pelo cliente',
      v_lead_nome || ' remarcou de ' || v_horario_antigo || ' para ' || v_horario_novo,
      v_compromisso.id,
      'compromisso'
    );
  END IF;

  -- Mensagem-sistema no chat
  IF v_lead_telefone IS NOT NULL AND v_compromisso.lead_id IS NOT NULL THEN
    INSERT INTO public.conversas (numero, telefone_formatado, mensagem, origem, status, tipo_mensagem, lead_id, company_id, owner_id, fromme, sent_by, read, delivered)
    VALUES (
      v_lead_telefone, v_lead_telefone,
      '🔄 *Cliente remarcou via link* — de ' || v_horario_antigo || ' para ' || v_horario_novo,
      'Sistema', 'Enviada', 'text',
      v_compromisso.lead_id, v_compromisso.company_id, v_compromisso.owner_id,
      true, 'sistema', true, true
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'nova_data', _nova_data,
    'horario', v_horario_novo
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_horarios_disponiveis_by_token(uuid, date, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reagendar_compromisso_by_token(uuid, timestamptz) TO anon, authenticated;
