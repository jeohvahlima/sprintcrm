import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface WMIAlert {
  id: string;
  alert_type: "regression" | "improvement" | "milestone";
  severity: "low" | "medium" | "high";
  pillar: string | null;
  title: string;
  message: string;
  delta_score: number | null;
  acknowledged: boolean;
  created_at: string;
}

export function useWMIAlerts() {
  return useQuery({
    queryKey: ["wmi_alerts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wmi_alerts" as any)
        .select("*")
        .eq("acknowledged", false)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as unknown as WMIAlert[];
    },
  });
}

export function useAcknowledgeAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("wmi_alerts" as any).update({ acknowledged: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wmi_alerts"] }),
  });
}

export function useWMIBenchmarkBySegment(segmento: string) {
  return useQuery({
    queryKey: ["wmi_benchmarks_seg", segmento],
    enabled: !!segmento,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wmi_benchmarks" as any)
        .select("*")
        .eq("segmento", segmento);
      if (error) throw error;
      return (data || []) as any[];
    },
  });
}

export function useFullWMIHistory() {
  return useQuery({
    queryKey: ["wmi_full_history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wmi_assessments" as any)
        .select("id, total_score, classification, pillar_processos, pillar_prospeccao, pillar_gestao, pillar_automacao, pillar_pessoas, created_at")
        .order("created_at", { ascending: true })
        .limit(24);
      if (error) throw error;
      return (data || []) as any[];
    },
  });
}
