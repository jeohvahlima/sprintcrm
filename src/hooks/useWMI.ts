import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface WMIPillar {
  score: number;
  max: number;
  metrics: Record<string, number>;
}

export interface WMIScore {
  company_id: string;
  total_score: number;
  classification: "Inicial" | "Estruturando" | "Previsível" | "Escalável";
  pillars: {
    processos: WMIPillar;
    prospeccao: WMIPillar;
    gestao: WMIPillar;
    automacao: WMIPillar;
    pessoas: WMIPillar;
  };
  calculated_at: string;
}

export function useWMIScore() {
  return useQuery({
    queryKey: ["wmi_score"],
    queryFn: async (): Promise<WMIScore> => {
      const { data, error } = await supabase.rpc("calculate_wmi_score" as any);
      if (error) throw error;
      return data as unknown as WMIScore;
    },
    staleTime: 60_000,
  });
}

export function useWMIBenchmarks() {
  return useQuery({
    queryKey: ["wmi_benchmarks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wmi_benchmarks" as any)
        .select("*")
        .eq("segmento", "geral");
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useWMIRoadmap() {
  return useQuery({
    queryKey: ["wmi_roadmap"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wmi_roadmap_items" as any)
        .select("*")
        .order("week")
        .order("priority");
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useGenerateRoadmap() {
  const qc = useQueryClient();
  const { data: score } = useWMIScore();
  return useMutation({
    mutationFn: async () => {
      if (!score) throw new Error("Score não carregado");
      const { data: companyId } = await supabase.rpc("get_my_company_id");

      // Salva snapshot do assessment
      const { data: assessment, error: aErr } = await supabase
        .from("wmi_assessments" as any)
        .insert({
          company_id: companyId,
          total_score: score.total_score,
          classification: score.classification,
          pillar_processos: score.pillars.processos.score,
          pillar_prospeccao: score.pillars.prospeccao.score,
          pillar_gestao: score.pillars.gestao.score,
          pillar_automacao: score.pillars.automacao.score,
          pillar_pessoas: score.pillars.pessoas.score,
          pillar_details: score.pillars,
        })
        .select()
        .single();
      if (aErr) throw aErr;

      // Chama IA
      const { data: ai, error: iErr } = await supabase.functions.invoke("advisor-ai", {
        body: { mode: "roadmap", assessment: score },
      });
      if (iErr) throw iErr;
      if (ai?.error) throw new Error(ai.error);

      const items = ai?.tool?.items || [];
      const diagnosis = ai?.tool?.diagnosis;

      if (diagnosis) {
        await supabase.from("wmi_assessments" as any).update({ ai_insights: diagnosis }).eq("id", (assessment as any).id);
      }

      // Limpa roadmap antigo "pending"
      await supabase.from("wmi_roadmap_items" as any).delete().eq("status", "pending");

      if (items.length) {
        await supabase.from("wmi_roadmap_items" as any).insert(
          items.map((i: any) => ({
            company_id: companyId,
            assessment_id: (assessment as any).id,
            week: i.week,
            pillar: i.pillar,
            priority: i.priority,
            title: i.title,
            description: i.description,
            expected_impact: i.expected_impact,
          }))
        );
      }

      return { items, diagnosis };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wmi_roadmap"] });
      qc.invalidateQueries({ queryKey: ["wmi_assessments_history"] });
    },
  });
}

export function useUpdateRoadmapItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("wmi_roadmap_items" as any)
        .update({ status, completed_at: status === "done" ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wmi_roadmap"] }),
  });
}

export function useWMIHistory() {
  return useQuery({
    queryKey: ["wmi_assessments_history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wmi_assessments" as any)
        .select("id, total_score, classification, created_at")
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      return (data as any[]).reverse();
    },
  });
}
