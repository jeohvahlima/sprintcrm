import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePlayerProfile } from "./usePlayerProfile";

export function useSalesTeams() {
  const { companyId } = usePlayerProfile();
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["sales-teams", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_teams" as any)
        .select("*")
        .eq("company_id", companyId!)
        .order("name");
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const create = useMutation({
    mutationFn: async (payload: any) => {
      const { error } = await supabase.from("sales_teams" as any).insert({
        ...payload,
        company_id: companyId,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sales-teams", companyId] }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...patch }: any) => {
      const { error } = await supabase.from("sales_teams" as any).update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sales-teams", companyId] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sales_teams" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sales-teams", companyId] }),
  });

  return { list, create, update, remove };
}

export function useUpdateCommercialRole() {
  const { companyId } = usePlayerProfile();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ user_id, commercial_role, team_id, commission_per_sale }: any) => {
      // Garante o profile e atualiza
      const { data: existing } = await supabase
        .from("prospecting_player_profile")
        .select("id")
        .eq("user_id", user_id)
        .eq("company_id", companyId!)
        .maybeSingle();
      if (existing) {
        const { error } = await supabase
          .from("prospecting_player_profile")
          .update({ commercial_role, team_id, commission_per_sale } as any)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("prospecting_player_profile")
          .insert({ user_id, company_id: companyId, commercial_role, team_id, commission_per_sale } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team-performance"] }),
  });
}
