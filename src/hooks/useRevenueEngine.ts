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
  // computed
  receita?: number;
  margem_valor?: number;
  lucro_liquido?: number;
  cac_total?: number;
  leads?: number;
  reunioes_agendadas?: number;
  reunioes_realizadas?: number;
}

export function computeOffer(o: RevenueOffer): RevenueOffer {
  const vendas = Number(o.target_sales) || 0;
  const ticket = Number(o.ticket) || 0;
  const winRate = (Number(o.win_rate) || 0) / 100;
  const showRate = (Number(o.meeting_show_rate) || 0) / 100;
  const leadToMeet = (Number(o.lead_to_meeting_rate) || 0) / 100;
  const cac = Number(o.cac) || 0;
  const marginPct = (Number(o.margin_pct) || 0) / 100;

  const reunioes_realizadas = winRate > 0 ? vendas / winRate : 0;
  const reunioes_agendadas = showRate > 0 ? reunioes_realizadas / showRate : 0;
  const leads = leadToMeet > 0 ? reunioes_agendadas / leadToMeet : 0;
  const receita = vendas * ticket;
  const margem_valor = receita * marginPct;
  const cac_total = cac * vendas;

  return { ...o, receita, margem_valor, cac_total, leads, reunioes_agendadas, reunioes_realizadas };
}

export function useProdutosServicos() {
  return useQuery({
    queryKey: ["produtos-servicos"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("produtos_servicos").select("*").order("nome", { ascending: true });
      return data || [];
    },
  });
}

export function useRevenueOffers(configId?: string) {
  return useQuery({
    queryKey: ["revenue-offers", configId],
    enabled: !!configId,
    queryFn: async () => {
      if (!configId) return [];
      const { data } = await (supabase as any)
        .from("revenue_offers")
        .select("*")
        .eq("config_id", configId)
        .order("position", { ascending: true });
      return data || [];
    },
  });
}

export function useUpsertOffer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (offer: RevenueOffer & { config_id: string }) => {
      const payload: any = {
        config_id: offer.config_id,
        name: offer.name,
        ticket: offer.ticket,
        margin_pct: offer.margin_pct,
        target_sales: offer.target_sales,
        lead_to_meeting_rate: offer.lead_to_meeting_rate,
        meeting_show_rate: offer.meeting_show_rate,
        win_rate: offer.win_rate,
        cac: offer.cac,
        position: offer.position,
      };
      if (offer.id) payload.id = offer.id;
      const { data, error } = await (supabase as any).from("revenue_offers").upsert(payload).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["revenue-offers", vars.config_id] }),
  });
}

export function useDeleteOffer(configId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("revenue_offers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["revenue-offers", configId] }),
  });
}
