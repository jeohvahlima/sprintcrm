import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type LadderTier = "front" | "back" | "high_end";

export interface ProductLadderItem {
  id: string;
  company_id: string;
  tier: LadderTier;
  nome: string;
  descricao: string | null;
  ticket: number;
  ciclo_dias: number | null;
  canal_aquisicao: string | null;
  objetivo: string | null;
  funcao_funil: string | null;
  ordem: number;
  ativo: boolean;
}

async function getCompanyId(): Promise<string> {
  const { data, error } = await supabase.rpc("get_my_company_id");
  if (error) throw error;
  return data as unknown as string;
}

/* ============= PRODUCT LADDER ============= */
export function useProductLadder() {
  return useQuery({
    queryKey: ["product_ladder"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_ladder" as any)
        .select("*")
        .order("tier")
        .order("ordem");
      if (error) throw error;
      return (data as any[]) as ProductLadderItem[];
    },
  });
}

export function useUpsertLadder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: Partial<ProductLadderItem> & { tier: LadderTier; nome: string }) => {
      const company_id = await getCompanyId();
      const payload: any = { ...item, company_id };
      if (item.id) {
        const { error } = await supabase.from("product_ladder" as any).update(payload).eq("id", item.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("product_ladder" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["product_ladder"] }),
  });
}

export function useDeleteLadder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("product_ladder" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["product_ladder"] }),
  });
}

/* ============= MARKETING FUNNEL TRACKS ============= */
export type Trilha = "vsl" | "social_selling" | "isca_paga";
export type TrilhaStatus = "nao_iniciado" | "em_construcao" | "ativo";

export interface FunnelStepProgress {
  id?: string;
  company_id?: string;
  trilha: Trilha;
  etapa_key: string;
  etapa_label: string;
  status: TrilhaStatus;
  observacoes?: string | null;
  ordem: number;
}

export const TRILHAS_TEMPLATE: Record<Trilha, { label: string; etapas: { key: string; label: string }[] }> = {
  vsl: {
    label: "VSL / Diagnóstico (Orgânico)",
    etapas: [
      { key: "oferta", label: "Oferta clara definida (problema/promessa)" },
      { key: "vsl_roteiro", label: "Roteiro de VSL escrito" },
      { key: "vsl_gravado", label: "VSL gravada e editada" },
      { key: "lp_diagnostico", label: "Landing page de diagnóstico ativa" },
      { key: "agendamento", label: "Agendamento integrado ao calendário" },
      { key: "follow_up", label: "Sequência de follow-up de no-show" },
      { key: "metricas", label: "Métricas (CTR/Booking/Show) monitoradas" },
    ],
  },
  social_selling: {
    label: "Social Selling (Orgânico)",
    etapas: [
      { key: "perfil", label: "Perfil otimizado (bio, capa, destaques)" },
      { key: "linha_editorial", label: "Linha editorial (autoridade/conexão/vendas)" },
      { key: "calendario", label: "Calendário de conteúdo semanal" },
      { key: "engajamento_ativo", label: "Rotina de engajamento ativo (DMs)" },
      { key: "ima_digital", label: "Ímã digital (lead magnet) entregando lead" },
      { key: "automacao_dm", label: "Automação de DMs / ManyChat" },
      { key: "nutricao", label: "Nutrição via lista (e-mail/WhatsApp)" },
    ],
  },
  isca_paga: {
    label: "Isca Paga (Anúncios)",
    etapas: [
      { key: "oferta_isca", label: "Oferta da isca definida" },
      { key: "criativos", label: "3+ criativos validados" },
      { key: "lp_captura", label: "Landing page de captura otimizada" },
      { key: "pixel_capi", label: "Pixel + CAPI configurado" },
      { key: "qualificacao", label: "Qualificação automática (formulário/bot)" },
      { key: "sla_contato", label: "SLA de contato < 5 minutos" },
      { key: "roas_meta", label: "ROAS alvo definido e tracking ativo" },
    ],
  },
};

export function useFunnelProgress() {
  return useQuery({
    queryKey: ["marketing_funnel_progress"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketing_funnel_progress" as any)
        .select("*");
      if (error) throw error;
      return (data as any[]) as FunnelStepProgress[];
    },
  });
}

export function useSaveFunnelStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (step: FunnelStepProgress) => {
      const company_id = await getCompanyId();
      const payload: any = { ...step, company_id };
      const { error } = await supabase
        .from("marketing_funnel_progress" as any)
        .upsert(payload, { onConflict: "company_id,trilha,etapa_key" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["marketing_funnel_progress"] }),
  });
}

/* ============= ICP STRUCTURED ============= */
export interface ICPStructured {
  id?: string;
  company_id?: string;
  quem_e: {
    segmento?: string;
    porte?: string;
    cargo_decisor?: string;
    faturamento?: string;
    geografia?: string;
  };
  dores: {
    principal?: string;
    secundarias?: string;
    consequencia?: string;
    tentativas_anteriores?: string;
  };
  gatilhos: {
    evento?: string;
    urgencia?: string;
    objecoes?: string;
    canais_preferidos?: string;
  };
}

export function useICPStructured() {
  return useQuery({
    queryKey: ["icp_structured"],
    queryFn: async (): Promise<ICPStructured> => {
      const { data, error } = await supabase
        .from("icp_structured" as any)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      const row = data as any;
      return {
        id: row?.id,
        company_id: row?.company_id,
        quem_e: row?.quem_e || {},
        dores: row?.dores || {},
        gatilhos: row?.gatilhos || {},
      };
    },
  });
}

export function useSaveICP() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (icp: ICPStructured) => {
      const company_id = await getCompanyId();
      const payload: any = {
        company_id,
        quem_e: icp.quem_e,
        dores: icp.dores,
        gatilhos: icp.gatilhos,
      };
      const { error } = await supabase
        .from("icp_structured" as any)
        .upsert(payload, { onConflict: "company_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["icp_structured"] }),
  });
}
