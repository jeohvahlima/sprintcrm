
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

  IF _acao = 'confirmar' THEN
    UPDATE public.lembretes
       SET status_envio = 'cancelado', ativo = false
     WHERE compromisso_id = v_compromisso.id
       AND status_envio IN ('pendente', 'retry')
       AND COALESCE(data_envio, data_hora_envio, now()) > now();
  END IF;

  v_horario_fmt := to_char(v_compromisso.data_hora_inicio AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI');

  IF v_compromisso.lead_id IS NOT NULL THEN
    SELECT name, COALESCE(phone, telefone) INTO v_lead_nome, v_lead_telefone
      FROM public.leads WHERE id = v_compromisso.lead_id;
  END IF;
  IF v_lead_nome IS NULL THEN v_lead_nome := COALESCE(v_compromisso.paciente, 'Lead'); END IF;
  IF v_lead_telefone IS NULL THEN v_lead_telefone := v_compromisso.telefone; END IF;

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

  -- Nota interna do sistema no chat (NÃO marcada como enviada via WhatsApp)
  IF v_lead_telefone IS NOT NULL AND v_compromisso.lead_id IS NOT NULL THEN
    v_msg_sistema := CASE
      WHEN _acao = 'confirmar' THEN '✅ Cliente confirmou o agendamento via link — ' || v_horario_fmt
      ELSE '❌ Cliente recusou o agendamento via link — ' || v_horario_fmt
    END;
    INSERT INTO public.conversas (numero, telefone_formatado, mensagem, origem, status, tipo_mensagem, lead_id, company_id, owner_id, fromme, sent_by, read, delivered)
    VALUES (
      v_lead_telefone, v_lead_telefone, v_msg_sistema, 'Sistema', 'Sistema', 'sistema',
      v_compromisso.lead_id, v_compromisso.company_id, v_compromisso.owner_id,
      false, 'sistema', true, false
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'status', v_novo_status);
END;
$function$;
