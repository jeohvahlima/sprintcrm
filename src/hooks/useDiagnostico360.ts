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
}

export interface DiagnosticoResposta {
  id: string;
  company_id: string;
  pontuacoes: Record<string, number>;
  respostas_perguntas: Record<string, boolean>;
  total_score: number;
  percentual: number;
  nota: "A" | "B" | "C" | "D";
  classificacao: string | null;
  diagnostico_ia: string | null;
  plano_acao_ia: any;
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
      "Processos definidos e resultados consistentes, mas existem falhas que impactam previsibilidade e conversão. Pode haver desperdício de oportunidades por falta de automação ou follow-up.",
    recomendacao:
      "Foco: identificar pontos de dispersão (leads não convertidos, clientes que não voltam, campanhas com baixo ROI). Estruture scripts, treine o time, otimize CRM e implemente rotina comercial clara.",
  },
  C: {
    titulo: "EMPRESA ATIVA, MAS SEM PREVISIBILIDADE",
    cor: "from-amber-500 to-orange-400",
    emoji: "⚠️",
    range: "50-69%",
    cenario:
      "Operação reativa. Processo comercial confuso ou fragmentado, equipe sem padrão, leads se perdem por falta de follow-up. Marketing gera volume, mas sem estratégia de retorno. Sem previsão de receita.",
    recomendacao:
      "Implante funil comercial completo. Padronize atendimento, implemente CRM funcional, crie rotina de reativação, treine a equipe e defina metas claras. Foco: previsibilidade, não apenas operação.",
  },
  D: {
    titulo: 'EMPRESA DESORGANIZADA ("BALDE FURADO")',
    cor: "from-rose-500 to-red-500",
    emoji: "🚨",
    range: "Abaixo de 49%",
    cenario:
      "Situação crítica. Sem processo comercial estruturado, sem CRM, atendimento reativo e informal. Investimento em mídia é desperdiçado. Leads entram, mas não são convertidos. Equipe sem direção.",
    recomendacao:
      "Recomeçar pela base: implementar CRM, capacitar equipe, padronizar scripts e fluxos, estruturar rotina comercial com metas e indicadores. Antes de investir em mídia, corrija a base — evite desperdiçar dinheiro e reputação.",
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

export function useSalvarDiagnostico() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      pontuacoes: Record<string, number>;
      respostas_perguntas: Record<string, boolean>;
    }) => {
      const { data: companyId } = await supabase.rpc("get_my_company_id");
      const { data: userData } = await supabase.auth.getUser();

      const total = Object.values(input.pontuacoes).reduce((a, b) => a + b, 0);
      const max = Object.keys(input.pontuacoes).length * 10;
      const percentual = max > 0 ? Math.round((total / max) * 100) : 0;
      const nota = calcularNota(percentual);
      const classificacao = CLASSIFICACOES[nota].titulo;

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
        })
        .select()
        .single();
      if (error) throw error;

      // Chama IA para gerar plano
      try {
        const { data: ai } = await supabase.functions.invoke("advisor-ai", {
          body: {
            mode: "diagnostico_360",
            diagnostic: {
              pontuacoes: input.pontuacoes,
              percentual,
              nota,
              classificacao,
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
    },
  });
}
