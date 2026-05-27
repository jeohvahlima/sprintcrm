// Follow Inteligente Engine — roda via cron a cada 5 min e executa follow-ups configurados
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FollowConfig {
  id: string;
  etapa_id: string;
  funil_id: string;
  company_id: string;
  ativo: boolean;
  tempo_valor: number;
  tempo_unidade: "minutos" | "horas" | "dias";
  canal: "whatsapp" | "tarefa" | "notificacao" | "nenhum";
  template_id: string | null;
  mensagem_custom: string | null;
  criar_tarefa: boolean;
  tarefa_titulo: string | null;
  notificar_responsavel: boolean;
  avancar_proxima_etapa: boolean;
}

function tempoToMs(valor: number, unidade: string): number {
  const factor = unidade === "minutos" ? 60_000 : unidade === "horas" ? 3_600_000 : 86_400_000;
  return valor * factor;
}

function renderTemplate(tpl: string, lead: any): string {
  return tpl
    .replace(/\{\{\s*nome\s*\}\}/gi, lead.name || lead.nome || "")
    .replace(/\{\{\s*primeiro_nome\s*\}\}/gi, (lead.name || "").split(" ")[0] || "")
    .replace(/\{\{\s*empresa\s*\}\}/gi, lead.company || "")
    .replace(/\{\{\s*servico\s*\}\}/gi, lead.servico || "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const summary: any = { configs: 0, leads_checked: 0, disparos: 0, erros: 0, detalhes: [] };

  try {
    // 1. Busca todas as configs ativas
    const { data: configs, error: cfgErr } = await admin
      .from("follow_etapa_config")
      .select("*")
      .eq("ativo", true);

    if (cfgErr) throw cfgErr;
    summary.configs = configs?.length ?? 0;
    if (!configs || configs.length === 0) {
      return new Response(JSON.stringify(summary), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2. Para cada config, busca leads elegíveis
    for (const cfg of configs as FollowConfig[]) {
      const limiarMs = tempoToMs(cfg.tempo_valor, cfg.tempo_unidade);
      const limiarISO = new Date(Date.now() - limiarMs).toISOString();

      // Lead elegível: na etapa configurada, last_interaction_at (ou last_movement_at) <= limiar
      const { data: leads, error: leadsErr } = await admin
        .from("leads")
        .select("id, name, telefone, phone, company, servico, responsavel_id, last_interaction_at, last_movement_at, follow_count, etapa_id, company_id, funil_id")
        .eq("etapa_id", cfg.etapa_id)
        .eq("company_id", cfg.company_id)
        .or(`last_interaction_at.lte.${limiarISO},last_interaction_at.is.null`);

      if (leadsErr) {
        summary.erros++;
        summary.detalhes.push({ config: cfg.id, error: leadsErr.message });
        continue;
      }
      if (!leads) continue;

      // Filtra por last_movement_at também (se nunca interagiu)
      const elegiveis = leads.filter((l: any) => {
        const ref = l.last_interaction_at ?? l.last_movement_at;
        if (!ref) return false;
        return new Date(ref).getTime() <= Date.now() - limiarMs;
      });

      summary.leads_checked += elegiveis.length;

      for (const lead of elegiveis) {
        // Evita disparo duplicado: já existe execução com mesmo lead/etapa após last_movement_at?
        const movRef = lead.last_movement_at ?? lead.last_interaction_at;
        const { data: jaExec } = await admin
          .from("follow_execucoes")
          .select("id")
          .eq("lead_id", lead.id)
          .eq("etapa_id", cfg.etapa_id)
          .eq("config_id", cfg.id)
          .gte("executado_em", movRef)
          .limit(1);

        if (jaExec && jaExec.length > 0) continue;

        // 3. Executa ação
        let acao = cfg.canal;
        let status = "sucesso";
        const detalhes: any = {};

        try {
          if (cfg.canal === "whatsapp") {
            // Busca template ou usa mensagem custom
            let mensagem = cfg.mensagem_custom || "";
            if (cfg.template_id) {
              const { data: tpl } = await admin
                .from("follow_templates")
                .select("conteudo")
                .eq("id", cfg.template_id)
                .maybeSingle();
              if (tpl?.conteudo) mensagem = tpl.conteudo;
            }
            mensagem = renderTemplate(mensagem, lead);

            const numero = lead.telefone || lead.phone;
            if (!numero || !mensagem) {
              status = "erro";
              detalhes.error = "Sem número ou mensagem";
            } else {
              const resp = await admin.functions.invoke("enviar-whatsapp", {
                body: {
                  numero,
                  mensagem,
                  tipo_mensagem: "text",
                  company_id: cfg.company_id,
                },
              });
              if (resp.error) {
                status = "erro";
                detalhes.error = resp.error.message;
              } else {
                detalhes.response = resp.data;
              }
            }
          } else if (cfg.canal === "tarefa" || cfg.criar_tarefa) {
            // cria tarefa
            const { error: tErr } = await admin.from("tarefas" as any).insert({
              titulo: cfg.tarefa_titulo || `Follow-up: ${lead.name}`,
              lead_id: lead.id,
              company_id: cfg.company_id,
              owner_id: lead.responsavel_id,
              status: "pendente",
            });
            if (tErr) {
              status = "erro";
              detalhes.error = tErr.message;
            }
            acao = "tarefa";
          } else if (cfg.canal === "notificacao") {
            if (lead.responsavel_id) {
              await admin.from("notifications" as any).insert({
                user_id: lead.responsavel_id,
                title: "Follow-up Inteligente",
                message: `Lead ${lead.name} está parado e precisa de retorno.`,
                type: "follow_up",
              });
            }
          }

          // Notificar responsável extra
          if (cfg.notificar_responsavel && lead.responsavel_id && cfg.canal !== "notificacao") {
            await admin.from("notifications" as any).insert({
              user_id: lead.responsavel_id,
              title: "Follow-up disparado",
              message: `Follow automático enviado para ${lead.name}.`,
              type: "follow_up",
            });
          }
        } catch (e: any) {
          status = "erro";
          detalhes.error = e.message;
        }

        // 4. Registra execução
        await admin.from("follow_execucoes").insert({
          lead_id: lead.id,
          etapa_id: cfg.etapa_id,
          company_id: cfg.company_id,
          config_id: cfg.id,
          acao,
          status,
          detalhes,
        });

        // 5. Atualiza contador e (opcionalmente) avança etapa
        await admin
          .from("leads")
          .update({
            follow_count: (lead.follow_count ?? 0) + 1,
            last_movement_at: cfg.avancar_proxima_etapa ? new Date().toISOString() : lead.last_movement_at,
          })
          .eq("id", lead.id);

        if (cfg.avancar_proxima_etapa) {
          // descobre próxima etapa por posicao
          const { data: etapaAtual } = await admin
            .from("etapas")
            .select("posicao, funil_id")
            .eq("id", cfg.etapa_id)
            .maybeSingle();
          if (etapaAtual) {
            const { data: proxima } = await admin
              .from("etapas")
              .select("id")
              .eq("funil_id", etapaAtual.funil_id)
              .gt("posicao", etapaAtual.posicao)
              .order("posicao", { ascending: true })
              .limit(1)
              .maybeSingle();
            if (proxima?.id) {
              await admin.from("leads").update({ etapa_id: proxima.id }).eq("id", lead.id);
            }
          }
        }

        summary.disparos++;
      }
    }

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message, summary }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
