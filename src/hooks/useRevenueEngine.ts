import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RevenueOffer {
  id?: string;
  config_id?: string;
  produto_servico_id?: string | null;
  name: string;
  ticket: number;
  margin_pct: number;
  target_sales: number;
  lead_to_meeting_rate: number;
  meeting_show_rate: number;
  win_rate: number;
  cac: number;
  position: number;
}

export interface OfferComputed extends RevenueOffer {
  receita: number;
  margem_valor: number;
  reunioes_realizadas: number;
  reunioes_agendadas: number;
  leads: number;
  cac_total: number;
  lucro_liquido: number;
}

export function computeOffer(o: RevenueOffer): OfferComputed {
  const receita = o.ticket * o.target_sales;
  const margem_valor = receita * (o.margin_pct / 100);
  const win = Math.max(o.win_rate, 0.0001) / 100;
  const show = Math.max(o.meeting_show_rate, 0.0001) / 100;
  const lead = Math.max(o.lead_to_meeting_rate, 0.0001) / 100;
  const reunioes_realizadas = Math.ceil(o.target_sales / win);
  const reunioes_agendadas = Math.ceil(reunioes_realizadas / show);
  const leads = Math.ceil(reunioes_agendadas / lead);
  const cac_total = o.cac * o.target_sales;
  const lucro_liquido = margem_valor - cac_total;
  return { ...o, receita, margem_valor, reunioes_realizadas, reunioes_agendadas, leads, cac_total, lucro_liquido };
}

export function useProdutosServicos() {
  return useQuery({
    queryKey: ["produtos_servicos_active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produtos_servicos")
        .select("id, nome, preco_sugerido, categoria")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data || [];
    },
  });
}

export function useRevenueOffers(configId?: string) {
  return useQuery({
    queryKey: ["revenue_offers", configId],
    queryFn: async () => {
      if (!configId) return [];
      const { data, error } = await supabase
        .from("revenue_machine_offers" as any)
        .select("*")
        .eq("config_id", configId)
        .order("position");
      if (error) throw error;
      return (data || []) as unknown as RevenueOffer[];
    },
    enabled: !!configId,
  });
}

export function useUpsertOffer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (o: RevenueOffer & { config_id: string }) => {
      const { data: companyId } = await supabase.rpc("get_my_company_id");
      const payload: any = { ...o, company_id: companyId };
      if (o.id) {
        const { error } = await supabase.from("revenue_machine_offers" as any).update(payload).eq("id", o.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("revenue_machine_offers" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["revenue_offers", v.config_id] }),
  });
}

export function useDeleteOffer(configId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("revenue_machine_offers" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["revenue_offers", configId] }),
  });
}
