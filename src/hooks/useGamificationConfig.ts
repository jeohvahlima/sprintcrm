import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface GamificationConfig {
  company_id: string;
  enabled: boolean;
  shop_enabled: boolean;
  xp_per_response: number;
  xp_per_opportunity: number;
  xp_per_meeting: number;
  xp_per_sale: number;
  xp_per_value_unit: number;
  coins_per_sale: number;
}

export function useGamificationConfig(companyId: string | null) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["gamification-config", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prospecting_gamification_config")
        .select("*")
        .eq("company_id", companyId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        await supabase
          .from("prospecting_gamification_config")
          .insert({ company_id: companyId! });
        const { data: d2 } = await supabase
          .from("prospecting_gamification_config")
          .select("*")
          .eq("company_id", companyId!)
          .maybeSingle();
        return d2 as GamificationConfig;
      }
      return data as GamificationConfig;
    },
  });

  const update = useMutation({
    mutationFn: async (patch: Partial<GamificationConfig>) => {
      const { error } = await supabase
        .from("prospecting_gamification_config")
        .update(patch)
        .eq("company_id", companyId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configuração salva");
      qc.invalidateQueries({ queryKey: ["gamification-config"] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

  return { ...query, update };
}
