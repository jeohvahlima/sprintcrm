// @ts-nocheck
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function admin() {
  return createClient(SUPABASE_URL, SERVICE_KEY);
}

async function log(execId: string, companyId: string, nodeId: string | null, nodeType: string | null, action: string, result: any = {}, error?: string) {
  await admin().from("commercial_script_logs").insert({
    execution_id: execId,
    company_id: companyId,
    node_id: nodeId,
    node_type: nodeType,
    action_taken: action,
    result,
    error_message: error,
  });
}

function interpolate(template: string, ctx: any): string {
  if (!template) return "";
  return template
    .replace(/\{\{nome\}\}/gi, ctx.lead_name || "")
    .replace(/\{\{telefone\}\}/gi, ctx.telefone_formatado || "");
}

async function sendMessage(execution: any, node: any) {
  const c = node.config || {};
  const supabase = admin();

  // Buscar conexão WhatsApp da empresa
  const { data: conn } = await supabase
    .from("whatsapp_connections")
    .select("*")
    .eq("company_id", execution.company_id)
    .eq("status", "connected")
    .limit(1)
    .maybeSingle();

  if (!conn) {
    throw new Error("Sem conexão WhatsApp ativa");
  }

  const content = interpolate(c.content || "", { ...execution.context, telefone_formatado: execution.telefone_formatado });

  const payload: any = {
    numero: execution.telefone_formatado,
    company_id: execution.company_id,
    tipo: c.message_type || "text",
  };
  if (c.message_type === "text" || !c.message_type) {
    payload.mensagem = content;
  } else {
    payload.media_url = content;
    payload.caption = c.caption || "";
  }

  const res = await supabase.functions.invoke("enviar-whatsapp", { body: payload });
  if (res.error) throw new Error(res.error.message || "Falha no envio");
  return res.data;
}

async function executeNode(execution: any, node: any): Promise<{ nextNodeId: string | null; delay?: number; waitReply?: boolean; timeoutMin?: number }> {
  const supabase = admin();
  const c = node.config || {};

  // Buscar próxima edge (default)
  const { data: edges } = await supabase
    .from("commercial_script_edges")
    .select("*")
    .eq("source_node_id", node.id);

  const defaultNext = (edges || []).find((e: any) => !e.source_handle || e.source_handle === "")?.target_node_id || null;

  switch (node.node_type) {
    case "message": {
      const result = await sendMessage(execution, node);
      await log(execution.id, execution.company_id, node.id, node.node_type, "message_sent", result);
      return { nextNodeId: defaultNext };
    }
    case "delay": {
      const seconds = c.seconds || 30;
      await log(execution.id, execution.company_id, node.id, node.node_type, "delay_scheduled", { seconds });
      return { nextNodeId: defaultNext, delay: seconds };
    }
    case "wait_reply": {
      await log(execution.id, execution.company_id, node.id, node.node_type, "waiting_reply", { timeout_min: c.timeout_minutes || 60 });
      return { nextNodeId: defaultNext, waitReply: true, timeoutMin: c.timeout_minutes || 60 };
    }
    case "condition": {
      const lastReply: string = (execution.context?.last_reply || "").toString().toLowerCase();
      const keywords: string[] = (c.keywords || []).map((k: string) => k.toLowerCase());
      let match = false;
      if (c.match_mode === "exact") {
        match = keywords.includes(lastReply.trim());
      } else if (c.match_mode === "all") {
        match = keywords.every((k) => lastReply.includes(k));
      } else {
        match = keywords.some((k) => lastReply.includes(k));
      }
      const branch = match ? "yes" : "no";
      const branchNext = (edges || []).find((e: any) => e.source_handle === branch)?.target_node_id || null;
      await log(execution.id, execution.company_id, node.id, node.node_type, "condition_evaluated", { match, branch, last_reply: lastReply });
      return { nextNodeId: branchNext };
    }
    case "action_tag": {
      if (execution.lead_id && c.tag) {
        const { data: lead } = await supabase.from("leads").select("tags").eq("id", execution.lead_id).maybeSingle();
        const current: string[] = lead?.tags || [];
        let newTags = current;
        if (c.action === "remove") {
          newTags = current.filter((t) => t !== c.tag);
        } else {
          if (!current.includes(c.tag)) newTags = [...current, c.tag];
        }
        await supabase.from("leads").update({ tags: newTags }).eq("id", execution.lead_id);
      }
      await log(execution.id, execution.company_id, node.id, node.node_type, "tag_action", { tag: c.tag, action: c.action });
      return { nextNodeId: defaultNext };
    }
    case "action_funnel": {
      if (execution.lead_id && c.etapa_id) {
        await supabase.from("leads").update({ etapa_id: c.etapa_id }).eq("id", execution.lead_id);
      }
      await log(execution.id, execution.company_id, node.id, node.node_type, "funnel_moved", { etapa_id: c.etapa_id });
      return { nextNodeId: defaultNext };
    }
    case "action_task": {
      if (execution.lead_id && c.title) {
        const due = new Date(Date.now() + (c.due_in_hours || 24) * 3600 * 1000).toISOString();
        await supabase.from("tarefas").insert({
          company_id: execution.company_id,
          titulo: c.title,
          descricao: `Criada por roteiro comercial`,
          lead_id: execution.lead_id,
          data_vencimento: due,
          status: "pendente",
        });
      }
      await log(execution.id, execution.company_id, node.id, node.node_type, "task_created", { title: c.title });
      return { nextNodeId: defaultNext };
    }
    case "end": {
      await log(execution.id, execution.company_id, node.id, node.node_type, "ended", {});
      return { nextNodeId: null };
    }
    default:
      return { nextNodeId: defaultNext };
  }
}

async function runExecution(executionId: string) {
  const supabase = admin();
  const { data: execution } = await supabase
    .from("commercial_script_executions")
    .select("*")
    .eq("id", executionId)
    .maybeSingle();
  if (!execution || execution.status !== "running") return;

  let currentId = execution.current_node_id;
  let safety = 0;

  while (currentId && safety < 50) {
    safety++;
    const { data: node } = await supabase
      .from("commercial_script_nodes")
      .select("*")
      .eq("id", currentId)
      .maybeSingle();
    if (!node) break;

    try {
      const r = await executeNode(execution, node);

      if (r.delay) {
        const nextRun = new Date(Date.now() + r.delay * 1000).toISOString();
        await supabase
          .from("commercial_script_executions")
          .update({ current_node_id: r.nextNodeId, next_run_at: nextRun, status: "running" })
          .eq("id", executionId);
        return; // cron continua depois
      }

      if (r.waitReply) {
        const timeoutAt = new Date(Date.now() + (r.timeoutMin || 60) * 60 * 1000).toISOString();
        await supabase
          .from("commercial_script_executions")
          .update({
            current_node_id: r.nextNodeId,
            status: "paused",
            next_run_at: timeoutAt,
            context: { ...execution.context, waiting_reply_since: new Date().toISOString() },
          })
          .eq("id", executionId);
        return;
      }

      currentId = r.nextNodeId;
      if (!currentId) {
        await supabase
          .from("commercial_script_executions")
          .update({ status: "completed", completed_at: new Date().toISOString(), current_node_id: null })
          .eq("id", executionId);
        return;
      }
    } catch (err: any) {
      console.error("Erro no nó:", err);
      await log(executionId, execution.company_id, currentId, node.node_type, "error", {}, err.message);
      await supabase
        .from("commercial_script_executions")
        .update({ status: "running", current_node_id: currentId })
        .eq("id", executionId);
      return;
    }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action } = body;
    const supabase = admin();

    if (action === "start") {
      const { script_id, conversation_id, lead_id, telefone_formatado } = body;

      const { data: script } = await supabase
        .from("commercial_scripts")
        .select("*")
        .eq("id", script_id)
        .maybeSingle();
      if (!script || !script.start_node_id) {
        return new Response(JSON.stringify({ error: "Roteiro inválido ou sem passos" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: exec, error } = await supabase
        .from("commercial_script_executions")
        .insert({
          company_id: script.company_id,
          script_id,
          conversation_id,
          lead_id,
          telefone_formatado,
          current_node_id: script.start_node_id,
          status: "running",
          trigger_type: "manual",
          context: { lead_name: "", telefone_formatado },
        })
        .select()
        .single();
      if (error) throw error;

      // Executa imediatamente em background
      runExecution(exec.id).catch(console.error);

      return new Response(JSON.stringify({ success: true, execution_id: exec.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "tick") {
      // Cron: processa execuções com next_run_at vencido
      const { data: pending } = await supabase
        .from("commercial_script_executions")
        .select("id")
        .in("status", ["running", "paused"])
        .lte("next_run_at", new Date().toISOString())
        .limit(20);
      for (const p of pending || []) {
        // se paused (esperando resposta) com timeout, retoma como running
        await supabase
          .from("commercial_script_executions")
          .update({ status: "running", next_run_at: null })
          .eq("id", p.id);
        await runExecution(p.id);
      }
      return new Response(JSON.stringify({ processed: pending?.length || 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "reply_received") {
      // Webhook: cliente respondeu; retoma execuções pausadas para esse telefone
      const { telefone_formatado, message } = body;
      const { data: paused } = await supabase
        .from("commercial_script_executions")
        .select("id, context")
        .eq("telefone_formatado", telefone_formatado)
        .eq("status", "paused");

      for (const p of paused || []) {
        await supabase
          .from("commercial_script_executions")
          .update({
            status: "running",
            next_run_at: null,
            context: { ...(p.context || {}), last_reply: message },
          })
          .eq("id", p.id);
        await runExecution(p.id);
      }

      return new Response(JSON.stringify({ resumed: paused?.length || 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[commercial-script-engine] erro:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
