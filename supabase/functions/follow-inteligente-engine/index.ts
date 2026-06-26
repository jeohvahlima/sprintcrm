// Follow Inteligente Engine v2 — integrado com IA Coach (cron 5 min)
// Cérebro: lead_coach_cache (script + temperatura + cadência da IA)
// Motor: cooldown dinâmico, cadência progressiva D1→D3→D7→D14, silêncio bilateral
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const COOLDOWN_POR_TEMPERATURA: Record<string, number> = {
  quente: 4,
  morno: 48,
  frio: 72,
};

const CADENCIA_STEPS = [
  { step: 1, label: "D+1", dias: 1 },
  { step: 2, label: "D+3", dias: 3 },
  { step: 3, label: "D+7", dias: 7, escalar: true },
  { step: 4, label: "D+14", dias: 14, mover_perdidos: true },
];

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
  usar_script_ia?: boolean;
  cooldown_dinamico?: boolean;
  cadencia_progressiva?: boolean;
  detectar_silencio_bilateral?: boolean;
  dias_silencio_bilateral?: number;
  escalar_gestor_em_dias?: number;
  gestor_id?: string | null;
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

function normalizePhone(p: string | null | undefined): string {
  return (p || "").replace(/\D/g, "");
}

async function detectarSilencioBilateral(admin: any, configs: FollowConfig[], summary: any) {
  for (const cfg of configs.filter((c) => c.detectar_silencio_bilateral)) {
    const limiarDias = cfg.dias_silencio_bilateral ?? 3;
    const limiarISO = new Date(Date.now() - limiarDias * 86_400_000).toISOString();

    const { data: leadsAbandonados } = await admin
      .from("leads")
      .select("id, name, telefone, phone, responsavel_id, last_interaction_at, last_lead_reply_at, follow_bilateral_silence_notified_at")
      .eq("etapa_id", cfg.etapa_id)
      .eq("company_id", cfg.company_id)
      .lte("last_interaction_at", limiarISO);

    for (const lead of leadsAbandonados ?? []) {
      if (lead.follow_bilateral_silence_notified_at) {
        const ultima = new Date(lead.follow_bilateral_silence_notified_at).getTime();
        if (Date.now() - ultima < 86_400_000) continue;
      }

      const refLead = lead.last_lead_reply_at ?? lead.last_interaction_at;
      const diasSemRespostaLead = refLead
        ? (Date.now() - new Date(refLead).getTime()) / 86_400_000
        : 999;

      if (diasSemRespostaLead < limiarDias) continue;

      if (lead.responsavel_id) {
        await admin.from("notificacoes" as any).insert({
          user_id: lead.responsavel_id,
          company_id: cfg.company_id,
          title: "🚨 Lead abandonado — ação necessária",
          message: `${lead.name} está ${Math.round(diasSemRespostaLead)} dias sem nenhuma interação. Recomendado contato imediato.`,
          type: "silencio_bilateral",
          metadata: { lead_id: lead.id, dias: Math.round(diasSemRespostaLead) },
        });
      }

      if (cfg.gestor_id && diasSemRespostaLead >= (cfg.escalar_gestor_em_dias ?? 7)) {
        await admin.from("notificacoes" as any).insert({
          user_id: cfg.gestor_id,
          company_id: cfg.company_id,
          title: "🔴 Lead crítico — escalar",
          message: `${lead.name} está ${Math.round(diasSemRespostaLead)} dias sem interação bilateral. Requer atenção do gestor.`,
          type: "escalar_gestor",
          metadata: { lead_id: lead.id, dias: Math.round(diasSemRespostaLead) },
        });
      }

      await admin
        .from("leads")
        .update({ follow_bilateral_silence_notified_at: new Date().toISOString() })
        .eq("id", lead.id);

      summary.silencio_bilateral_alertas = (summary.silencio_bilateral_alertas || 0) + 1;
    }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const summary: any = {
    configs: 0,
    leads_checked: 0,
    disparos: 0,
    pulados: 0,
    erros: 0,
    silencio_bilateral_alertas: 0,
    coach_analises: 0,
    detalhes: [],
  };

  const leadsProcessadosNestaRun = new Set<string>();

  try {
    const { data: configs, error: cfgErr } = await admin
      .from("follow_etapa_config")
      .select("*")
      .eq("ativo", true);

    if (cfgErr) throw cfgErr;
    summary.configs = configs?.length ?? 0;
    if (!configs || configs.length === 0) {
      return new Response(JSON.stringify(summary), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Detecção de silêncio bilateral antes do loop principal
    await detectarSilencioBilateral(admin, configs as FollowConfig[], summary);

    for (const cfg of configs as FollowConfig[]) {
      const limiarMs = tempoToMs(cfg.tempo_valor, cfg.tempo_unidade);
      const limiarISO = new Date(Date.now() - limiarMs).toISOString();

      const { data: leads, error: leadsErr } = await admin
        .from("leads")
        .select(
          "id, name, telefone, phone, company, servico, responsavel_id, last_interaction_at, last_lead_reply_at, last_movement_at, follow_count, follow_step, etapa_id, company_id, funil_id",
        )
        .eq("etapa_id", cfg.etapa_id)
        .eq("company_id", cfg.company_id);

      if (leadsErr) {
        summary.erros++;
        summary.detalhes.push({ config: cfg.id, error: leadsErr.message });
        continue;
      }
      if (!leads) continue;

      const elegiveis = leads.filter((l: any) => {
        const ref = l.last_lead_reply_at ?? l.last_movement_at ?? l.last_interaction_at;
        if (!ref) return false;
        return new Date(ref).getTime() <= Date.now() - limiarMs;
      });

      for (const lead of elegiveis) {
        summary.leads_checked++;

        // [Trava 1] Dedupe na mesma run
        if (leadsProcessadosNestaRun.has(lead.id)) {
          summary.pulados++;
          continue;
        }

        // [Trava 4] Lead respondeu após o último envio → reset
        if (lead.last_lead_reply_at) {
          const { data: ultimoEnvio } = await admin
            .from("follow_execucoes")
            .select("executado_em")
            .eq("lead_id", lead.id)
            .eq("status", "sucesso")
            .order("executado_em", { ascending: false })
            .limit(1);
          const ultimaExecISO = ultimoEnvio?.[0]?.executado_em;
          if (ultimaExecISO && new Date(lead.last_lead_reply_at) > new Date(ultimaExecISO)) {
            summary.pulados++;
            continue;
          }
        }

        const numeroNormalizado = normalizePhone(lead.telefone || lead.phone);

        // [Trava 5] Atendimento humano ativo
        if (numeroNormalizado) {
          const { data: atendendo } = await admin
            .from("active_attendances")
            .select("id")
            .eq("company_id", cfg.company_id)
            .eq("telefone_formatado", numeroNormalizado)
            .gte("expires_at", new Date().toISOString())
            .limit(1);
          if (atendendo && atendendo.length > 0) {
            summary.pulados++;
            continue;
          }
        }

        // [Trava 6 NOVA] Buscar cache da IA Coach (em vez de pular leads com IA ativa)
        let coachCache: any = null;
        const { data: cacheRow } = await admin
          .from("lead_coach_cache")
          .select(
            "temperatura, risco_de_perda, score_engajamento, score_intencao, score_fit, script, scripts_alternativos, cadencia, objecoes_detectadas, proximos_passos, resumo, expires_at",
          )
          .eq("lead_id", lead.id)
          .gt("expires_at", new Date().toISOString())
          .maybeSingle();
        coachCache = cacheRow;

        // Se não há cache válido e a config quer usar IA, invocar análise agora
        if (!coachCache && cfg.usar_script_ia !== false) {
          try {
            const { data: analise } = await admin.functions.invoke("lead-coach-analyze", {
              body: { lead_id: lead.id, company_id: cfg.company_id },
            });
            if (analise?.report) {
              const report = analise.report;
              await admin
                .from("lead_coach_cache")
                .upsert(
                  {
                    lead_id: lead.id,
                    company_id: cfg.company_id,
                    temperatura: report.temperatura,
                    risco_de_perda: report.risco_de_perda,
                    score_engajamento: report.score_engajamento,
                    score_intencao: report.score_intencao,
                    score_fit: report.score_fit,
                    script: report.mensagem_sugerida || report.abordagem_ideal,
                    scripts_alternativos: report.scripts_alternativos ?? [],
                    cadencia: report.cadencia ?? [],
                    objecoes_detectadas: report.objecoes_detectadas ?? [],
                    proximos_passos: report.proximos_passos ?? [],
                    resumo: report.resumo_interacao,
                    analisado_em: new Date().toISOString(),
                    expires_at: new Date(Date.now() + 6 * 3_600_000).toISOString(),
                  },
                  { onConflict: "lead_id" },
                );
              coachCache = {
                temperatura: report.temperatura,
                risco_de_perda: report.risco_de_perda,
                script: report.mensagem_sugerida || report.abordagem_ideal,
                scripts_alternativos: report.scripts_alternativos ?? [],
                cadencia: report.cadencia ?? [],
              };
              summary.coach_analises++;
            }
          } catch (e: any) {
            summary.detalhes.push({ lead: lead.id, warn: "coach analyze failed: " + (e?.message || "?") });
          }
        }

        // [Trava 2 NOVA] Cadência progressiva — qual step é o próximo?
        const cadenciaAtiva = cfg.cadencia_progressiva !== false;
        const nextStep = (lead.follow_step ?? 0) + 1;
        const stepConfig = cadenciaAtiva
          ? CADENCIA_STEPS.find((s) => s.step === nextStep)
          : null;

        if (cadenciaAtiva && !stepConfig) {
          // Cadência completa
          summary.pulados++;
          continue;
        }

        if (cadenciaAtiva && stepConfig) {
          const { data: ultimoDisparo } = await admin
            .from("follow_execucoes")
            .select("executado_em")
            .eq("lead_id", lead.id)
            .eq("status", "sucesso")
            .order("executado_em", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (ultimoDisparo?.executado_em) {
            const diasDesdeUltimo =
              (Date.now() - new Date(ultimoDisparo.executado_em).getTime()) / 86_400_000;
            if (diasDesdeUltimo < stepConfig.dias) {
              summary.pulados++;
              continue;
            }
          }
        }

        // [Trava 3 NOVA] Cooldown dinâmico por temperatura
        const temperatura = coachCache?.temperatura ?? "morno";
        const cooldownHoras =
          cfg.cooldown_dinamico !== false
            ? COOLDOWN_POR_TEMPERATURA[temperatura] ?? 24
            : 24;
        const cooldownISO = new Date(Date.now() - cooldownHoras * 3_600_000).toISOString();

        const { data: jaCooldown } = await admin
          .from("follow_execucoes")
          .select("id")
          .eq("lead_id", lead.id)
          .eq("status", "sucesso")
          .gte("executado_em", cooldownISO)
          .limit(1);
        if (jaCooldown && jaCooldown.length > 0) {
          summary.pulados++;
          continue;
        }

        leadsProcessadosNestaRun.add(lead.id);

        // Anti-corrida
        const { data: execRow, error: execInsertErr } = await admin
          .from("follow_execucoes")
          .insert({
            lead_id: lead.id,
            etapa_id: cfg.etapa_id,
            company_id: cfg.company_id,
            config_id: cfg.id,
            acao: cfg.canal,
            status: "enviando",
            detalhes: { step: nextStep, temperatura },
          })
          .select("id")
          .single();

        if (execInsertErr || !execRow) {
          summary.erros++;
          summary.detalhes.push({ lead: lead.id, error: execInsertErr?.message || "insert exec falhou" });
          continue;
        }

        let acao = cfg.canal;
        let status = "sucesso";
        const detalhes: any = { step: nextStep, temperatura };

        try {
          if (cfg.canal === "whatsapp") {
            let mensagem = "";

            // 1º — script da IA Coach
            if (cfg.usar_script_ia !== false && coachCache?.script) {
              const alts = Array.isArray(coachCache.scripts_alternativos)
                ? coachCache.scripts_alternativos
                : [];
              if (nextStep >= 2 && alts.length >= nextStep - 1) {
                mensagem = String(alts[nextStep - 2] || coachCache.script);
              } else {
                mensagem = String(coachCache.script);
              }
              detalhes.fonte_script = "ia_coach";
            }

            // 2º — fallback estático
            if (!mensagem) {
              mensagem = cfg.mensagem_custom || "";
              if (cfg.template_id) {
                const { data: tpl } = await admin
                  .from("follow_templates")
                  .select("conteudo")
                  .eq("id", cfg.template_id)
                  .maybeSingle();
                if (tpl?.conteudo) mensagem = tpl.conteudo;
              }
              detalhes.fonte_script = "estatico";
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
              await admin.from("notificacoes" as any).insert({
                user_id: lead.responsavel_id,
                company_id: cfg.company_id,
                title: "Follow-up Inteligente",
                message: `Lead ${lead.name} está parado e precisa de retorno.`,
                type: "follow_up",
              });
            }
          }

          if (cfg.notificar_responsavel && lead.responsavel_id && cfg.canal !== "notificacao") {
            await admin.from("notificacoes" as any).insert({
              user_id: lead.responsavel_id,
              company_id: cfg.company_id,
              title: "Follow-up disparado",
              message: `Follow automático (${CADENCIA_STEPS.find((s) => s.step === nextStep)?.label ?? ""}) enviado para ${lead.name}.`,
              type: "follow_up",
            });
          }

          // Escalar gestor no step D+7
          if (status === "sucesso" && stepConfig?.escalar && cfg.gestor_id) {
            await admin.from("notificacoes" as any).insert({
              user_id: cfg.gestor_id,
              company_id: cfg.company_id,
              title: "⚠️ Lead em escalonamento (D+7)",
              message: `${lead.name} atingiu o 3º follow sem fechar. Considere assumir.`,
              type: "escalar_gestor",
              metadata: { lead_id: lead.id },
            });
          }
        } catch (e: any) {
          status = "erro";
          detalhes.error = e.message;
        }

        await admin.from("follow_execucoes").update({ acao, status, detalhes }).eq("id", execRow.id);

        if (status === "sucesso") {
          await admin
            .from("leads")
            .update({
              follow_count: (lead.follow_count ?? 0) + 1,
              follow_step: nextStep,
              last_movement_at: cfg.avancar_proxima_etapa
                ? new Date().toISOString()
                : lead.last_movement_at,
            })
            .eq("id", lead.id);

          // Se o step finalizado é "mover_perdidos" → mover etapa
          if (stepConfig?.mover_perdidos) {
            const { data: etapaPerdidos } = await admin
              .from("etapas")
              .select("id")
              .eq("funil_id", lead.funil_id)
              .ilike("nome", "%perdido%")
              .limit(1)
              .maybeSingle();
            if (etapaPerdidos?.id) {
              await admin.from("leads").update({ etapa_id: etapaPerdidos.id }).eq("id", lead.id);
            }
          } else if (cfg.avancar_proxima_etapa) {
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
        } else {
          summary.erros++;
        }
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
