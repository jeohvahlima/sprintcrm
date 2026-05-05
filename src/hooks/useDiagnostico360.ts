import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Alavanca {
  id: string;
  numero: number;
  nome: string;
  foco: string;
  descricao: string;
  icon: string;
  cor: string;
}

export interface Pergunta {
  id: string;
  alavanca_id: string;
  ordem: number;
  pergunta: string;
  segmento?: string | null;
}

export interface DoresDesejos {
  principal_dor?: string;
  principal_desejo?: string;
  o_que_travou?: string;
  meta_faturamento?: number;
  faturamento_atual?: number;
  prazo_meta_meses?: number;
  swot_forcas?: string;
  swot_fraquezas?: string;
  swot_oportunidades?: string;
  swot_ameacas?: string;
  observacoes_alavanca?: Record<string, string>;
  // KPIs operacionais para o motor "Custo da Inação"
  ticket_medio?: number;
  taxa_conversao?: number; // 0-100 (%)
  prospeccoes_dia_atual?: number;
  prospeccoes_dia_ideal?: number;
  dias_uteis_mes?: number;
  curva_abc?: ProdutoABC[];
}

export interface ProdutoABC {
  id?: string;
  produto_servico_id?: string | null;
  nome: string;
  receita_mensal: number;
  custo_unitario?: number;
  qtd_vendas_mes?: number;
  curva?: "A" | "B" | "C";
  pct_receita?: number;
  pct_acumulado?: number;
  margem_pct?: number;
}

/** Classifica produtos em A/B/C usando regra Pareto (80/15/5). Retorna nova lista ordenada e enriquecida. */
export function classificarCurvaABC(produtos: ProdutoABC[]): ProdutoABC[] {
  const valid = produtos.filter((p) => p.nome && Number(p.receita_mensal) > 0);
  if (!valid.length) return [];
  const total = valid.reduce((s, p) => s + Number(p.receita_mensal || 0), 0);
  const ord = [...valid].sort((a, b) => Number(b.receita_mensal) - Number(a.receita_mensal));
  let acc = 0;
  return ord.map((p) => {
    const pct = total > 0 ? (Number(p.receita_mensal) / total) * 100 : 0;
    acc += pct;
    let curva: "A" | "B" | "C" = "C";
    if (acc <= 80) curva = "A";
    else if (acc <= 95) curva = "B";
    const margem_pct =
      p.custo_unitario && p.qtd_vendas_mes && p.receita_mensal
        ? Math.max(0, ((p.receita_mensal - p.custo_unitario * p.qtd_vendas_mes) / p.receita_mensal) * 100)
        : undefined;
    return { ...p, curva, pct_receita: pct, pct_acumulado: acc, margem_pct };
  });
}

export interface RevenueLeak {
  receita_potencial: number;
  receita_atual_estimada: number;
  perda_mensal: number;
  perda_diaria: number;
  perda_projetada: number; // no prazo escolhido
  capacidade_uso_pct: number;
  prazo_meses: number;
  leads_ideais_mes: number;
  leads_atuais_mes: number;
  clientes_potenciais: number;
  clientes_atuais: number;
}

/** Calcula o "Revenue Leak Engine" com base nos KPIs informados */
export function calcularRevenueLeak(d: DoresDesejos): RevenueLeak | null {
  const ticket = Number(d.ticket_medio) || 0;
  const conv = (Number(d.taxa_conversao) || 0) / 100;
  const dias = Number(d.dias_uteis_mes) || 20;
  const atualDia = Number(d.prospeccoes_dia_atual) || 0;
  const idealDia = Number(d.prospeccoes_dia_ideal) || 0;
  const prazo = Number(d.prazo_meta_meses) || 3;
  if (!ticket || !conv || (!atualDia && !idealDia)) return null;

  const leadsIdeaisMes = idealDia * dias;
  const leadsAtuaisMes = atualDia * dias;
  const clientesPotenciais = leadsIdeaisMes * conv;
  const clientesAtuais = leadsAtuaisMes * conv;
  const receitaPotencial = clientesPotenciais * ticket;
  const receitaAtualEst = clientesAtuais * ticket;
  const perdaMensal = Math.max(0, receitaPotencial - receitaAtualEst);
  const perdaDiaria = perdaMensal / dias;
  const perdaProjetada = perdaMensal * prazo;
  const capacidadePct = receitaPotencial > 0
    ? Math.round((receitaAtualEst / receitaPotencial) * 100)
    : 0;

  return {
    receita_potencial: receitaPotencial,
    receita_atual_estimada: receitaAtualEst,
    perda_mensal: perdaMensal,
    perda_diaria: perdaDiaria,
    perda_projetada: perdaProjetada,
    capacidade_uso_pct: capacidadePct,
    prazo_meses: prazo,
    leads_ideais_mes: leadsIdeaisMes,
    leads_atuais_mes: leadsAtuaisMes,
    clientes_potenciais: clientesPotenciais,
    clientes_atuais: clientesAtuais,
  };
}

export interface GargaloDetectado {
  key: string;
  titulo: string;
  alavanca_id?: string;
  severidade: "alta" | "media" | "baixa";
}

export interface DiagnosticoResposta extends DoresDesejos {
  id: string;
  company_id: string;
  segmento?: string | null;
  pontuacoes: Record<string, number>;
  respostas_perguntas: Record<string, boolean>;
  total_score: number;
  percentual: number;
  nota: "A" | "B" | "C" | "D";
  classificacao: string | null;
  diagnostico_ia: string | null;
  plano_acao_ia: any;
  gargalos_detectados?: GargaloDetectado[];
  revenue_leak?: RevenueLeak | null;
  created_at: string;
}

export const CLASSIFICACOES = {
  A: {
    titulo: "EMPRESA ESTRUTURADA E EM FASE DE ESCALA",
    cor: "from-emerald-500 to-green-400",
    emoji: "🚀",
    range: "90-100%",
    cenario:
      "Sua empresa tem um processo comercial eficiente, previsível e estruturado. Utiliza CRM, automações, scripts, reativação e métricas. Equipe treinada e campanhas com bom desempenho.",
    recomendacao:
      "Hora de escalar. Reforce planejamento estratégico, aumente LTV, implemente KPIs avançados (CAC por canal, rentabilidade por produto). Invista em expansão, IA comercial e automação de recorrência.",
  },
  B: {
    titulo: "EMPRESA COM ESTRUTURA FUNCIONAL, MAS COM GARGALOS",
    cor: "from-blue-500 to-cyan-400",
    emoji: "🏗️",
    range: "70-89%",
    cenario:
      "Processos definidos e resultados consistentes, mas existem falhas que impactam previsibilidade e conversão.",
    recomendacao:
      "Foco: identificar pontos de dispersão, estruturar scripts, treinar o time, otimizar CRM e implementar rotina comercial clara.",
  },
  C: {
    titulo: "EMPRESA ATIVA, MAS SEM PREVISIBILIDADE",
    cor: "from-amber-500 to-orange-400",
    emoji: "⚠️",
    range: "50-69%",
    cenario:
      "Operação reativa. Processo comercial confuso, equipe sem padrão, leads se perdem por falta de follow-up.",
    recomendacao:
      "Implante funil comercial completo. Padronize atendimento, implemente CRM funcional, crie rotina de reativação, treine a equipe e defina metas claras.",
  },
  D: {
    titulo: 'EMPRESA DESORGANIZADA ("BALDE FURADO")',
    cor: "from-rose-500 to-red-500",
    emoji: "🚨",
    range: "Abaixo de 49%",
    cenario:
      "Situação crítica. Sem processo comercial estruturado, sem CRM, atendimento informal. Investimento em mídia é desperdiçado.",
    recomendacao:
      "Recomeçar pela base: implementar CRM, capacitar equipe, padronizar scripts e fluxos, estruturar rotina comercial com metas e indicadores.",
  },
} as const;

export function calcularNota(percentual: number): "A" | "B" | "C" | "D" {
  if (percentual >= 90) return "A";
  if (percentual >= 70) return "B";
  if (percentual >= 50) return "C";
  return "D";
}

export function useAlavancas() {
  return useQuery({
    queryKey: ["diag_alavancas"],
    queryFn: async (): Promise<Alavanca[]> => {
      const { data, error } = await supabase
        .from("diagnostico_alavancas" as any)
        .select("*")
        .order("numero");
      if (error) throw error;
      return data as unknown as Alavanca[];
    },
    staleTime: 5 * 60_000,
  });
}

export function usePerguntas() {
  return useQuery({
    queryKey: ["diag_perguntas"],
    queryFn: async (): Promise<Pergunta[]> => {
      const { data, error } = await supabase
        .from("diagnostico_perguntas" as any)
        .select("*")
        .order("ordem");
      if (error) throw error;
      return data as unknown as Pergunta[];
    },
    staleTime: 5 * 60_000,
  });
}

/** Perguntas extras específicas do segmento da empresa */
export function usePerguntasSegmento(segmento?: string | null) {
  return useQuery({
    queryKey: ["diag_perguntas_seg", segmento],
    enabled: !!segmento,
    queryFn: async (): Promise<Pergunta[]> => {
      const { data, error } = await supabase
        .from("diagnostico_perguntas_segmento" as any)
        .select("*")
        .eq("segmento", segmento!)
        .order("ordem");
      if (error) throw error;
      return (data || []) as unknown as Pergunta[];
    },
    staleTime: 5 * 60_000,
  });
}

export function useUltimoDiagnostico() {
  return useQuery({
    queryKey: ["diag_ultimo"],
    queryFn: async (): Promise<DiagnosticoResposta | null> => {
      const { data, error } = await supabase
        .from("diagnostico_respostas" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as DiagnosticoResposta | null;
    },
  });
}

export function useHistoricoDiagnostico() {
  return useQuery({
    queryKey: ["diag_historico"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("diagnostico_respostas" as any)
        .select("id, total_score, percentual, nota, created_at")
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      return ((data as any[]) || []).reverse();
    },
  });
}

/** Detecta gargalos a partir das respostas + dores */
export function detectarGargalos(
  alavancas: Alavanca[],
  pontuacoes: Record<string, number>,
  dores: DoresDesejos
): GargaloDetectado[] {
  const out: GargaloDetectado[] = [];

  alavancas.forEach((a) => {
    const score = pontuacoes[a.id] || 0;
    if (score < 4) {
      out.push({
        key: `alavanca_${a.numero}_critico`,
        titulo: `${a.nome} crítica (${score}/10)`,
        alavanca_id: a.id,
        severidade: "alta",
      });
    } else if (score < 6) {
      out.push({
        key: `alavanca_${a.numero}_atencao`,
        titulo: `${a.nome} precisa de atenção (${score}/10)`,
        alavanca_id: a.id,
        severidade: "media",
      });
    }
  });

  if (dores.faturamento_atual && dores.meta_faturamento) {
    const gap = dores.meta_faturamento - dores.faturamento_atual;
    if (gap > dores.faturamento_atual) {
      out.push({
        key: "meta_agressiva",
        titulo: `Meta agressiva: ${Math.round((gap / dores.faturamento_atual) * 100)}% acima do faturamento atual`,
        severidade: "alta",
      });
    }
  }
  if (dores.principal_dor && dores.principal_dor.length > 10) {
    out.push({
      key: "dor_principal",
      titulo: `Dor crítica reportada: ${dores.principal_dor.slice(0, 80)}${dores.principal_dor.length > 80 ? "..." : ""}`,
      severidade: "alta",
    });
  }

  return out;
}

export function useSalvarDiagnostico() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      pontuacoes: Record<string, number>;
      respostas_perguntas: Record<string, boolean>;
      dores?: DoresDesejos;
      segmento?: string | null;
      gargalos?: GargaloDetectado[];
    }) => {
      const dores = input.dores || {};
      const gargalos = input.gargalos || [];
      const { data: companyId } = await supabase.rpc("get_my_company_id");
      const { data: userData } = await supabase.auth.getUser();

      const total = Object.values(input.pontuacoes).reduce((a, b) => a + b, 0);
      const max = Object.keys(input.pontuacoes).length * 10;
      const percentual = max > 0 ? Math.round((total / max) * 100) : 0;
      const nota = calcularNota(percentual);
      const classificacao = CLASSIFICACOES[nota].titulo;
      const revenueLeak = calcularRevenueLeak(dores);
      // Classifica curva ABC (se preenchida)
      const curvaABC = classificarCurvaABC((dores.curva_abc as ProdutoABC[]) || []);
      const doresFinal = { ...dores, curva_abc: curvaABC };

      const { data: saved, error } = await supabase
        .from("diagnostico_respostas" as any)
        .insert({
          company_id: companyId,
          user_id: userData.user?.id,
          pontuacoes: input.pontuacoes,
          respostas_perguntas: input.respostas_perguntas,
          total_score: total,
          percentual,
          nota,
          classificacao,
          segmento: input.segmento,
          gargalos_detectados: gargalos as any,
          revenue_leak: revenueLeak as any,
          ...doresFinal,
        })
        .select()
        .single();
      if (error) throw error;

      // Persistir gargalos como itens rastreáveis
      if (gargalos.length) {
        await supabase.from("diagnostico_gargalos_corrigidos" as any).insert(
          gargalos.map((g) => ({
            company_id: companyId,
            diagnostico_id: (saved as any).id,
            gargalo_key: g.key,
            gargalo_titulo: g.titulo,
            alavanca_id: g.alavanca_id || null,
            status: "pendente",
          }))
        );
      }

      // Chama IA para gerar plano + dispara roadmap em paralelo
      try {
        const { data: ai } = await supabase.functions.invoke("advisor-ai", {
          body: {
            mode: "diagnostico_360",
            diagnostic: {
              pontuacoes: input.pontuacoes,
              percentual,
              nota,
              classificacao,
              segmento: input.segmento,
              dores: doresFinal,
              gargalos,
              revenue_leak: revenueLeak,
              curva_abc: curvaABC,
              prazo_meses: dores.prazo_meta_meses || 3,
            },
          },
        });
        if (ai?.content) {
          await supabase
            .from("diagnostico_respostas" as any)
            .update({ diagnostico_ia: ai.content })
            .eq("id", (saved as any).id);
          (saved as any).diagnostico_ia = ai.content;
        }
      } catch (e) {
        console.warn("IA não respondeu", e);
      }

      return saved as unknown as DiagnosticoResposta;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["diag_ultimo"] });
      qc.invalidateQueries({ queryKey: ["diag_historico"] });
      qc.invalidateQueries({ queryKey: ["diag_gargalos"] });
    },
  });
}

// ============== GARGALOS — Acompanhamento ==============
export function useGargalos(diagnosticoId?: string) {
  return useQuery({
    queryKey: ["diag_gargalos", diagnosticoId],
    enabled: !!diagnosticoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("diagnostico_gargalos_corrigidos" as any)
        .select("*")
        .eq("diagnostico_id", diagnosticoId!)
        .order("created_at");
      if (error) throw error;
      return (data || []) as any[];
    },
  });
}

export function useUpdateGargaloStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, evidencia }: { id: string; status: string; evidencia?: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      const patch: any = { status };
      if (status === "corrigido") {
        patch.corrigido_em = new Date().toISOString();
        patch.corrigido_por = userData.user?.id;
      } else {
        patch.corrigido_em = null;
      }
      if (evidencia !== undefined) patch.evidencia = evidencia;
      const { error } = await supabase
        .from("diagnostico_gargalos_corrigidos" as any)
        .update(patch)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["diag_gargalos"] }),
  });
}

// ============== ROADMAP — gerar a partir do diagnóstico (prazo dinâmico) ==============
export function useGerarRoadmapDiagnostico() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (diagnostico: DiagnosticoResposta) => {
      const { data: companyId } = await supabase.rpc("get_my_company_id");
      const prazoMeses = diagnostico.prazo_meta_meses || 3;

      const assessment = {
        prazo_meses: prazoMeses,
        nota: diagnostico.nota,
        percentual: diagnostico.percentual,
        classificacao: diagnostico.classificacao,
        pontuacoes: diagnostico.pontuacoes,
        revenue_leak: diagnostico.revenue_leak,
        dores: {
          principal_dor: diagnostico.principal_dor,
          principal_desejo: diagnostico.principal_desejo,
          faturamento_atual: diagnostico.faturamento_atual,
          meta_faturamento: diagnostico.meta_faturamento,
          prazo_meta_meses: prazoMeses,
        },
      };

      const { data: ai, error } = await supabase.functions.invoke("advisor-ai", {
        body: { mode: "roadmap", assessment },
      });
      if (error) throw error;
      if (ai?.error) throw new Error(ai.error);

      const items = ai?.tool?.items || [];

      // Limpa roadmap antigo "pending" da empresa
      await supabase.from("wmi_roadmap_items" as any).delete().eq("company_id", companyId).eq("status", "pending");

      if (items.length) {
        await supabase.from("wmi_roadmap_items" as any).insert(
          items.map((i: any) => ({
            company_id: companyId,
            week: i.week,
            pillar: i.pillar,
            priority: i.priority === "critical" ? "high" : i.priority,
            title: i.title,
            description: i.description,
            expected_impact: i.expected_impact,
          }))
        );
      }
      return items;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wmi_roadmap"] });
    },
  });
}
