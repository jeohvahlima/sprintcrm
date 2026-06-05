import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schemas
const createBoardSchema = z.object({
  nome: z.string().trim().min(2, 'Nome muito curto').max(100, 'Nome muito longo'),
  descricao: z.string().max(500).optional()
});

const createColumnSchema = z.object({
  nome: z.string().trim().min(2, 'Nome muito curto').max(100, 'Nome muito longo'),
  board_id: z.string().uuid('ID de board inválido'),
  posicao: z.number().int().min(0).optional(),
  cor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor inválida').optional()
});

const createTaskSchema = z.object({
  title: z.string().trim().min(2, 'Título muito curto').max(200, 'Título muito longo'),
  description: z.string().max(2000, 'Descrição muito longa').nullable().optional(),
  assignee_id: z.string().uuid('ID de responsável inválido').nullable().optional(),
  responsaveis: z.array(z.string().uuid('ID de responsável inválido')).optional(),
  lead_id: z.string().uuid('ID de lead inválido').nullable().optional(),
  column_id: z.string().uuid('ID de coluna inválido').nullable().optional(),
  board_id: z.string().uuid('ID de board inválido').nullable().optional(),
  due_date: z.string().datetime().nullable().optional(),
  priority: z.enum(['baixa', 'media', 'alta', 'urgente']).optional(),
  tags: z.array(z.string()).optional(),
  checklist: z.array(z.object({ id: z.string().optional(), text: z.string(), done: z.boolean() })).optional(),
  comments: z.array(z.object({ id: z.string().optional(), text: z.string(), author_id: z.string().uuid().nullable().optional(), created_at: z.string().optional() })).optional(),
  attachments: z.array(z.object({ name: z.string(), url: z.string().url() })).optional()
});

const moveTaskSchema = z.object({
  task_id: z.string().uuid('ID de tarefa inválido'),
  nova_coluna_id: z.string().uuid('ID de coluna inválido')
});

const deleteTaskSchema = z.object({
  task_id: z.string().uuid('ID de tarefa inválido')
});

const editTaskSchema = z.object({
  task_id: z.string().uuid('ID de tarefa inválido'),
  title: z.string().trim().min(2, 'Título muito curto').max(200, 'Título muito longo').optional(),
  description: z.string().max(2000, 'Descrição muito longa').nullable().optional(),
  priority: z.enum(['baixa', 'media', 'alta', 'urgente']).optional(),
  status: z.enum(['pendente', 'em_andamento', 'concluido', 'cancelado']).optional(),
  column_id: z.string().uuid('ID de coluna inválido').nullable().optional(),
  due_date: z.string().datetime().nullable().optional(),
  assignee_id: z.string().uuid('ID de responsável inválido').nullable().optional(),
  responsaveis: z.array(z.string().uuid('ID de responsável inválido')).optional(),
  lead_id: z.string().uuid('ID de lead inválido').nullable().optional(),
  tags: z.array(z.string()).optional(),
  checklist: z.array(z.object({ id: z.string().optional(), text: z.string(), done: z.boolean() })).optional(),
  comments: z.array(z.object({ id: z.string().optional(), text: z.string(), author_id: z.string().uuid().nullable().optional(), author_name: z.string().optional(), attachments: z.array(z.object({ name: z.string(), url: z.string().url() })).optional(), created_at: z.string().optional() })).optional(),
  attachments: z.array(z.object({ name: z.string(), url: z.string().url() })).optional()
});

const editBoardSchema = z.object({
  board_id: z.string().uuid('ID de board inválido'),
  nome: z.string().trim().min(2, 'Nome muito curto').max(100, 'Nome muito longo')
});

const deleteBoardSchema = z.object({
  board_id: z.string().uuid('ID de board inválido')
});

const editColumnSchema = z.object({
  column_id: z.string().uuid('ID de coluna inválido'),
  nome: z.string().trim().min(2, 'Nome muito curto').max(100, 'Nome muito longo').optional(),
  cor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor inválida').optional()
});

const deleteColumnSchema = z.object({
  column_id: z.string().uuid('ID de coluna inválido')
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization')!;

    if (!authHeader) {
      console.error('❌ [API-TAREFAS] Authorization header não encontrado');
      return new Response(
        JSON.stringify({ error: "Não autorizado", code: "UNAUTHORIZED" }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Cliente com token do usuário para autenticação
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    // Cliente com service role para bypass RLS (após validação manual de company_id)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      console.error('❌ [API-TAREFAS] Erro de autenticação:', authError);
      return new Response(
        JSON.stringify({ error: "Não autorizado", code: "UNAUTHORIZED", details: authError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's company_id
    const { data: userRole, error: userRoleError } = await supabase
      .from('user_roles')
      .select('company_id, role')
      .eq('user_id', user.id)
      .single();

    console.log('User role lookup:', { userId: user.id, userRole, error: userRoleError });

    if (userRoleError || !userRole?.company_id) {
      console.error('User role error:', userRoleError);
      return new Response(
        JSON.stringify({
          error: "Você não tem permissão para esta ação. Verifique se está associado a uma empresa.",
          code: "FORBIDDEN",
          details: userRoleError?.message
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const companyId = userRole.company_id;
    const { action, data } = await req.json();
    console.log(`Action: ${action}`);

    switch (action) {
      case "criar_board": {
        const validatedData = createBoardSchema.parse(data);
        const { data: board, error } = await supabase
          .from("task_boards")
          .insert([{ nome: validatedData.nome, descricao: validatedData.descricao, owner_id: user.id, company_id: companyId }])
          .select()
          .single();

        if (error) {
          console.error("Error creating board:", error);
          return new Response(
            JSON.stringify({ error: "Erro ao criar board", code: "DATABASE_ERROR" }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // ✅ NOVO: Criar coluna "Ganho" automaticamente (coluna fixa)
        console.log('📦 [API-TAREFAS] Criando coluna fixa "Ganho" para o novo board...');
        const { error: ganhoError } = await supabase
          .from("task_columns")
          .insert([{
            nome: '✅ Ganho',
            board_id: board.id,
            posicao: 9999, // Alta posição para ficar no final
            cor: '#22c55e', // Verde sucesso
            company_id: companyId,
            is_fixed: true // Marcador para coluna fixa
          }]);
        
        if (ganhoError) {
          console.warn('⚠️ [API-TAREFAS] Erro ao criar coluna Ganho (não bloqueante):', ganhoError);
        } else {
          console.log('✅ [API-TAREFAS] Coluna "Ganho" criada com sucesso');
        }

        return new Response(JSON.stringify({ success: true, data: board }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case "criar_coluna": {
        const validatedData = createColumnSchema.parse(data);
        
        // ✅ SEGURANÇA: Verificar se o board pertence à mesma company_id
        const { data: board, error: boardError } = await supabase
          .from("task_boards")
          .select("id, company_id")
          .eq("id", validatedData.board_id)
          .single();

        if (boardError || !board) {
          return new Response(
            JSON.stringify({ error: "Board não encontrado", code: "NOT_FOUND" }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (board.company_id !== companyId) {
          return new Response(
            JSON.stringify({ error: "Você não tem permissão para criar coluna neste board", code: "FORBIDDEN" }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: column, error } = await supabase
          .from("task_columns")
          .insert([{ 
            nome: validatedData.nome, 
            board_id: validatedData.board_id, 
            posicao: validatedData.posicao || 0, 
            cor: validatedData.cor || '#6b7280', 
            company_id: companyId 
          }])
          .select()
          .single();

        if (error) {
          console.error("Error creating column:", error);
          return new Response(
            JSON.stringify({ error: "Erro ao criar coluna", code: "DATABASE_ERROR" }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(JSON.stringify({ success: true, data: column }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case "criar_tarefa": {
        console.log('📥 [API-TAREFAS] Recebendo dados para criar tarefa:', JSON.stringify(data, null, 2));
        
        // Normalizar dados antes de validar (converter strings vazias para null)
        const normalizedData = {
          ...data,
          assignee_id: data.assignee_id && typeof data.assignee_id === 'string' && data.assignee_id.trim() ? data.assignee_id : null,
          lead_id: data.lead_id && typeof data.lead_id === 'string' && data.lead_id.trim() ? data.lead_id : null,
          column_id: data.column_id && typeof data.column_id === 'string' && data.column_id.trim() ? data.column_id : null,
          board_id: data.board_id && typeof data.board_id === 'string' && data.board_id.trim() ? data.board_id : null,
          description: data.description && typeof data.description === 'string' && data.description.trim() ? data.description : null,
        };

        console.log('📦 [API-TAREFAS] Dados normalizados:', JSON.stringify(normalizedData, null, 2));

        let validatedData;
        try {
          validatedData = createTaskSchema.parse(normalizedData);
          console.log('✅ [API-TAREFAS] Dados validados com sucesso');
        } catch (validationError: any) {
          console.error('❌ [API-TAREFAS] Erro de validação:', validationError);
          if (validationError instanceof z.ZodError) {
            const errorDetails = validationError.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
            console.error('❌ [API-TAREFAS] Detalhes do erro:', errorDetails);
            return new Response(
              JSON.stringify({
                error: "Dados inválidos",
                code: "VALIDATION_ERROR",
                details: errorDetails
              }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          throw validationError;
        }

        console.log('Creating task with data:', {
          title: validatedData.title,
          assignee_id: validatedData.assignee_id,
          lead_id: validatedData.lead_id,
          column_id: validatedData.column_id,
          board_id: validatedData.board_id,
          owner_id: user.id,
          company_id: companyId
        });

        // SOLUÇÃO DEFINITIVA: Usar apenas campos que DEFINITIVAMENTE existem
        // Baseado na estrutura real da tabela tasks
        const taskInsert: any = {
          title: validatedData.title,
          description: validatedData.description || null,
          assignee_id: validatedData.assignee_id || null,
          responsaveis: validatedData.responsaveis || [],
          lead_id: validatedData.lead_id || null,
          column_id: validatedData.column_id || null,
          board_id: validatedData.board_id || null,
          due_date: validatedData.due_date || null,
          priority: validatedData.priority || 'media',
          status: 'pendente',
          owner_id: user.id,
          company_id: companyId,
        };

        // Adicionar apenas checklist se fornecido (é o único campo JSONB que sabemos que existe)
        if (validatedData.checklist && Array.isArray(validatedData.checklist) && validatedData.checklist.length > 0) {
          taskInsert.checklist = validatedData.checklist;
        }

        console.log('📝 [API-TAREFAS] Inserindo tarefa com dados:', JSON.stringify(taskInsert, null, 2));

        let task, error;
        const result = await supabase
          .from("tasks")
          .insert([taskInsert])
          .select()
          .single();
        
        task = result.data;
        error = result.error;

        // Se falhou por causa de algum campo, tentar novamente sem campos opcionais
        if (error && error.message?.includes('column')) {
          console.warn('⚠️ [API-TAREFAS] Erro com campo opcional, tentando apenas campos essenciais...');
          const essentialTaskInsert: any = {
            title: validatedData.title,
            description: validatedData.description || null,
            assignee_id: validatedData.assignee_id || null,
            lead_id: validatedData.lead_id || null,
            due_date: validatedData.due_date || null,
            priority: validatedData.priority || 'media',
            status: 'pendente',
            owner_id: user.id,
            company_id: companyId,
          };

          const retryResult = await supabase
            .from("tasks")
            .insert([essentialTaskInsert])
            .select()
            .single();
          
          task = retryResult.data;
          error = retryResult.error;
        }

        if (error) {
          console.error("Error creating task:", error);
          console.error("Error details:", {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code
          });
          return new Response(
            JSON.stringify({
              error: "Erro ao criar tarefa",
              code: "DATABASE_ERROR",
              details: error.message
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('Task created successfully:', task);

        return new Response(JSON.stringify({ success: true, data: task }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case "mover_tarefa": {
        const validatedData = moveTaskSchema.parse(data);
        
        // ✅ SEGURANÇA: Verificar se a tarefa pertence à mesma company_id
        const { data: existingTask, error: fetchError } = await supabase
          .from("tasks")
          .select("id, company_id, checklist")
          .eq("id", validatedData.task_id)
          .single();

        if (fetchError || !existingTask) {
          return new Response(
            JSON.stringify({ error: "Tarefa não encontrada", code: "NOT_FOUND" }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (existingTask.company_id !== companyId) {
          return new Response(
            JSON.stringify({ error: "Você não tem permissão para mover esta tarefa", code: "FORBIDDEN" }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Verificar se a nova coluna pertence à mesma company_id
        const { data: column, error: columnError } = await supabase
          .from("task_columns")
          .select("id, company_id, nome")
          .eq("id", validatedData.nova_coluna_id)
          .single();

        if (columnError || !column) {
          return new Response(
            JSON.stringify({ error: "Coluna não encontrada", code: "NOT_FOUND" }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (column.company_id !== companyId) {
          return new Response(
            JSON.stringify({ error: "Você não tem permissão para mover para esta coluna", code: "FORBIDDEN" }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // ✅ NOVO: Verificar se a coluna destino é "Ganho" para marcar tarefa como concluída
        const isGanhoColumn = column.nome?.toLowerCase().includes('ganho') || 
                              column.nome?.toLowerCase().includes('concluído') ||
                              column.nome?.toLowerCase().includes('concluido') ||
                              column.nome?.includes('✅');
        
        let updateData: any = { column_id: validatedData.nova_coluna_id };
        
        // Se for coluna de ganho, marcar todos os checklists como concluídos
        if (isGanhoColumn && existingTask.checklist && Array.isArray(existingTask.checklist) && existingTask.checklist.length > 0) {
          console.log('🏆 [API-TAREFAS] Tarefa movida para coluna Ganho - marcando todos checklists como concluídos');
          const completedChecklist = existingTask.checklist.map((item: any) => ({
            ...item,
            done: true
          }));
          updateData.checklist = completedChecklist;
          updateData.status = 'concluido'; // Marcar status como concluído
        } else if (isGanhoColumn) {
          // Se não tem checklist, apenas marcar status como concluído
          updateData.status = 'concluido';
        }

        console.log('📝 [API-TAREFAS] Movendo tarefa:', { 
          task_id: validatedData.task_id, 
          nova_coluna_id: validatedData.nova_coluna_id,
          company_id: companyId,
          updateData 
        });

        const { data: updatedTask, error } = await supabase
          .from("tasks")
          .update(updateData)
          .eq("id", validatedData.task_id)
          .eq("company_id", companyId)
          .select()
          .single();

        if (error) {
          console.error("❌ [API-TAREFAS] Error moving task:", error);
          return new Response(
            JSON.stringify({ error: "Erro ao mover tarefa", code: "DATABASE_ERROR", details: error.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (!updatedTask) {
          console.error("❌ [API-TAREFAS] Nenhuma tarefa foi atualizada - pode ser problema de company_id ou tarefa não existe");
          return new Response(
            JSON.stringify({ error: "Tarefa não encontrada ou sem permissão", code: "NOT_FOUND" }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('✅ [API-TAREFAS] Tarefa movida com sucesso:', updatedTask.id);

        return new Response(JSON.stringify({ success: true, isCompleted: isGanhoColumn, data: updatedTask }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case "deletar_tarefa": {
        const validatedData = deleteTaskSchema.parse(data);
        
        // ✅ SEGURANÇA: Verificar se a tarefa pertence à mesma company_id
        const { data: existingTask, error: fetchError } = await supabase
          .from("tasks")
          .select("id, company_id")
          .eq("id", validatedData.task_id)
          .single();

        if (fetchError || !existingTask) {
          return new Response(
            JSON.stringify({ error: "Tarefa não encontrada", code: "NOT_FOUND" }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (existingTask.company_id !== companyId) {
          return new Response(
            JSON.stringify({ error: "Você não tem permissão para deletar esta tarefa", code: "FORBIDDEN" }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error } = await supabase
          .from("tasks")
          .delete()
          .eq("id", validatedData.task_id)
          .eq("company_id", companyId);

        if (error) {
          console.error("Error deleting task:", error);
          return new Response(
            JSON.stringify({ error: "Erro ao deletar tarefa", code: "DATABASE_ERROR" }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case "editar_tarefa": {
        const validatedData = editTaskSchema.parse(data);
        
        // ✅ SEGURANÇA: Verificar se a tarefa pertence à mesma company_id
        const { data: existingTask, error: fetchError } = await supabase
          .from("tasks")
          .select("id, company_id")
          .eq("id", validatedData.task_id)
          .single();

        if (fetchError || !existingTask) {
          return new Response(
            JSON.stringify({ error: "Tarefa não encontrada", code: "NOT_FOUND" }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (existingTask.company_id !== companyId) {
          return new Response(
            JSON.stringify({ error: "Você não tem permissão para editar esta tarefa", code: "FORBIDDEN" }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Preparar objeto de atualização apenas com campos fornecidos
        const updateData: any = {};
        if (validatedData.title !== undefined) updateData.title = validatedData.title;
        if (validatedData.description !== undefined) updateData.description = validatedData.description;
        if (validatedData.priority !== undefined) updateData.priority = validatedData.priority;
        if (validatedData.status !== undefined) updateData.status = validatedData.status;
        if (validatedData.column_id !== undefined) updateData.column_id = validatedData.column_id;
        if (validatedData.due_date !== undefined) updateData.due_date = validatedData.due_date;
        if (validatedData.assignee_id !== undefined) updateData.assignee_id = validatedData.assignee_id;
        if (validatedData.responsaveis !== undefined) updateData.responsaveis = validatedData.responsaveis;
        if (validatedData.lead_id !== undefined) updateData.lead_id = validatedData.lead_id;
        if (validatedData.tags !== undefined) updateData.tags = validatedData.tags;
        if (validatedData.checklist !== undefined) updateData.checklist = validatedData.checklist;
        if (validatedData.comments !== undefined) updateData.comments = validatedData.comments;
        if (validatedData.attachments !== undefined) updateData.attachments = validatedData.attachments;

        const { data: task, error } = await supabase
          .from("tasks")
          .update(updateData)
          .eq("id", validatedData.task_id)
          .eq("company_id", companyId)
          .select()
          .single();

        if (error) {
          console.error("Error updating task:", error);
          return new Response(
            JSON.stringify({ error: "Erro ao atualizar tarefa", code: "DATABASE_ERROR", details: error.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(JSON.stringify({ success: true, data: task }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case "editar_board": {
        const validatedData = editBoardSchema.parse(data);
        
        // ✅ SEGURANÇA: Verificar se o board pertence à mesma company_id
        const { data: existingBoard, error: fetchError } = await supabase
          .from("task_boards")
          .select("id, company_id")
          .eq("id", validatedData.board_id)
          .single();

        if (fetchError || !existingBoard) {
          return new Response(
            JSON.stringify({ error: "Board não encontrado", code: "NOT_FOUND" }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (existingBoard.company_id !== companyId) {
          return new Response(
            JSON.stringify({ error: "Você não tem permissão para editar este board", code: "FORBIDDEN" }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: board, error } = await supabase
          .from("task_boards")
          .update({ nome: validatedData.nome })
          .eq("id", validatedData.board_id)
          .eq("company_id", companyId)
          .select()
          .single();

        if (error) {
          console.error("Error updating board:", error);
          return new Response(
            JSON.stringify({ error: "Erro ao atualizar board", code: "DATABASE_ERROR" }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(JSON.stringify({ success: true, data: board }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case "deletar_board": {
        const validatedData = deleteBoardSchema.parse(data);
        
        // ✅ SEGURANÇA: Verificar se o board pertence à mesma company_id
        const { data: existingBoard, error: fetchError } = await supabase
          .from("task_boards")
          .select("id, company_id")
          .eq("id", validatedData.board_id)
          .single();

        if (fetchError || !existingBoard) {
          return new Response(
            JSON.stringify({ error: "Board não encontrado", code: "NOT_FOUND" }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (existingBoard.company_id !== companyId) {
          return new Response(
            JSON.stringify({ error: "Você não tem permissão para deletar este board", code: "FORBIDDEN" }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Primeiro deletar todas as colunas do board (apenas da mesma company)
        await supabase
          .from("task_columns")
          .delete()
          .eq("board_id", validatedData.board_id)
          .eq("company_id", companyId);
        
        // Depois deletar o board
        const { error } = await supabase
          .from("task_boards")
          .delete()
          .eq("id", validatedData.board_id)
          .eq("company_id", companyId);

        if (error) {
          console.error("Error deleting board:", error);
          return new Response(
            JSON.stringify({ error: "Erro ao deletar board", code: "DATABASE_ERROR" }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case "editar_coluna": {
        const validatedData = editColumnSchema.parse(data);
        
        // ✅ SEGURANÇA: Verificar se a coluna pertence à mesma company_id
        const { data: existingColumn, error: fetchError } = await supabase
          .from("task_columns")
          .select("id, company_id")
          .eq("id", validatedData.column_id)
          .single();

        if (fetchError || !existingColumn) {
          return new Response(
            JSON.stringify({ error: "Coluna não encontrada", code: "NOT_FOUND" }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (existingColumn.company_id !== companyId) {
          return new Response(
            JSON.stringify({ error: "Você não tem permissão para editar esta coluna", code: "FORBIDDEN" }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const updateData: any = {};
        if (validatedData.nome !== undefined) updateData.nome = validatedData.nome;
        if (validatedData.cor !== undefined) updateData.cor = validatedData.cor;

        const { data: column, error } = await supabase
          .from("task_columns")
          .update(updateData)
          .eq("id", validatedData.column_id)
          .eq("company_id", companyId)
          .select()
          .single();

        if (error) {
          console.error("Error updating column:", error);
          return new Response(
            JSON.stringify({ error: "Erro ao atualizar coluna", code: "DATABASE_ERROR" }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(JSON.stringify({ success: true, data: column }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case "deletar_coluna": {
        const validatedData = deleteColumnSchema.parse(data);
        
        // ✅ SEGURANÇA: Verificar se a coluna pertence à mesma company_id
        const { data: existingColumn, error: fetchError } = await supabase
          .from("task_columns")
          .select("id, company_id")
          .eq("id", validatedData.column_id)
          .single();

        if (fetchError || !existingColumn) {
          return new Response(
            JSON.stringify({ error: "Coluna não encontrada", code: "NOT_FOUND" }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (existingColumn.company_id !== companyId) {
          return new Response(
            JSON.stringify({ error: "Você não tem permissão para deletar esta coluna", code: "FORBIDDEN" }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error } = await supabase
          .from("task_columns")
          .delete()
          .eq("id", validatedData.column_id)
          .eq("company_id", companyId);

        if (error) {
          console.error("Error deleting column:", error);
          return new Response(
            JSON.stringify({ error: "Erro ao deletar coluna", code: "DATABASE_ERROR" }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      default:
        return new Response(
          JSON.stringify({ error: "Ação inválida", code: "INVALID_ACTION" }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error("Error in api-tarefas:", error);
    
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({ error: 'Dados inválidos fornecidos', code: 'VALIDATION_ERROR', details: error.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify({ error: "Erro interno ao processar requisição", code: "INTERNAL_ERROR" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});