
-- Bidirectional sync between tasks and compromissos (tipo_servico = 'tarefa')
-- Uses tasks.compromisso_id as the link and a session GUC to prevent recursion.

CREATE OR REPLACE FUNCTION public.sync_task_to_compromisso()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sync text;
  v_new_comp uuid;
BEGIN
  BEGIN
    v_sync := current_setting('app.sync_tarefa_agenda', true);
  EXCEPTION WHEN OTHERS THEN
    v_sync := NULL;
  END;
  IF v_sync = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  PERFORM set_config('app.sync_tarefa_agenda', 'on', true);

  IF TG_OP = 'DELETE' THEN
    IF OLD.compromisso_id IS NOT NULL THEN
      DELETE FROM public.compromissos WHERE id = OLD.compromisso_id;
    END IF;
    PERFORM set_config('app.sync_tarefa_agenda', 'off', true);
    RETURN OLD;
  END IF;

  IF NEW.due_date IS NULL THEN
    -- remove linked compromisso if due_date cleared
    IF TG_OP = 'UPDATE' AND OLD.compromisso_id IS NOT NULL THEN
      DELETE FROM public.compromissos WHERE id = OLD.compromisso_id;
      NEW.compromisso_id := NULL;
    END IF;
    PERFORM set_config('app.sync_tarefa_agenda', 'off', true);
    RETURN NEW;
  END IF;

  IF NEW.compromisso_id IS NULL THEN
    INSERT INTO public.compromissos (
      usuario_responsavel_id, owner_id, data_hora_inicio, data_hora_fim,
      tipo_servico, status, titulo, observacoes, company_id, lead_id
    ) VALUES (
      COALESCE(NEW.assignee_id, NEW.owner_id), NEW.owner_id,
      NEW.due_date, NEW.due_date + interval '1 hour',
      'tarefa', 'agendado', NEW.title, NEW.description, NEW.company_id, NEW.lead_id
    ) RETURNING id INTO v_new_comp;
    NEW.compromisso_id := v_new_comp;
  ELSE
    UPDATE public.compromissos
       SET data_hora_inicio = NEW.due_date,
           data_hora_fim    = NEW.due_date + interval '1 hour',
           titulo           = NEW.title,
           observacoes      = NEW.description,
           lead_id          = NEW.lead_id,
           usuario_responsavel_id = COALESCE(NEW.assignee_id, NEW.owner_id)
     WHERE id = NEW.compromisso_id;
  END IF;

  PERFORM set_config('app.sync_tarefa_agenda', 'off', true);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_compromisso_to_task()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sync text;
  v_task_id uuid;
BEGIN
  BEGIN
    v_sync := current_setting('app.sync_tarefa_agenda', true);
  EXCEPTION WHEN OTHERS THEN
    v_sync := NULL;
  END;
  IF v_sync = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  PERFORM set_config('app.sync_tarefa_agenda', 'on', true);

  IF TG_OP = 'DELETE' THEN
    IF OLD.tipo_servico = 'tarefa' THEN
      DELETE FROM public.tasks WHERE compromisso_id = OLD.id;
    END IF;
    PERFORM set_config('app.sync_tarefa_agenda', 'off', true);
    RETURN OLD;
  END IF;

  IF NEW.tipo_servico <> 'tarefa' THEN
    -- if it changed away from 'tarefa', drop linked task
    IF TG_OP = 'UPDATE' AND OLD.tipo_servico = 'tarefa' THEN
      DELETE FROM public.tasks WHERE compromisso_id = OLD.id;
    END IF;
    PERFORM set_config('app.sync_tarefa_agenda', 'off', true);
    RETURN NEW;
  END IF;

  SELECT id INTO v_task_id FROM public.tasks WHERE compromisso_id = NEW.id LIMIT 1;

  IF v_task_id IS NULL THEN
    INSERT INTO public.tasks (
      title, description, status, priority, owner_id, assignee_id,
      due_date, company_id, lead_id, compromisso_id, external_source
    ) VALUES (
      COALESCE(NEW.titulo, NEW.tipo_servico, 'Tarefa'),
      NEW.observacoes,
      'pendente', 'media',
      NEW.owner_id, NEW.usuario_responsavel_id,
      NEW.data_hora_inicio, NEW.company_id, NEW.lead_id, NEW.id,
      'agenda'
    );
  ELSE
    UPDATE public.tasks
       SET title       = COALESCE(NEW.titulo, title),
           description = NEW.observacoes,
           due_date    = NEW.data_hora_inicio,
           assignee_id = NEW.usuario_responsavel_id,
           lead_id     = NEW.lead_id
     WHERE id = v_task_id;
  END IF;

  PERFORM set_config('app.sync_tarefa_agenda', 'off', true);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_task_to_compromisso ON public.tasks;
CREATE TRIGGER trg_sync_task_to_compromisso
BEFORE INSERT OR UPDATE OR DELETE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.sync_task_to_compromisso();

DROP TRIGGER IF EXISTS trg_sync_compromisso_to_task ON public.compromissos;
CREATE TRIGGER trg_sync_compromisso_to_task
AFTER INSERT OR UPDATE OR DELETE ON public.compromissos
FOR EACH ROW EXECUTE FUNCTION public.sync_compromisso_to_task();

-- Ensure realtime is publishing both tables
DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='tasks';
  IF NOT FOUND THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks';
  END IF;
END $$;
