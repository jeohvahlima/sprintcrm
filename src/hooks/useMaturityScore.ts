import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PillarScore {
  score: number;
  max: number;
  metrics: Record<string, number>;
}

export interface MaturityScore {
  total_score: number;
  level: string;
  pillars: {
    prospeccao: PillarScore;
    processos: PillarScore;
    discador: PillarScore;
    automacao: PillarScore;
  };
  calculated_at: string;
}

export function useMaturityScore() {
  return useQuery({
    queryKey: ["commercial_maturity_score"],
    queryFn: async (): Promise<MaturityScore> => {
      const { data, error } = await supabase.rpc("get_commercial_maturity_score" as any);
      if (error) throw error;
      return data as unknown as MaturityScore;
    },
    staleTime: 60_000,
  });
}
