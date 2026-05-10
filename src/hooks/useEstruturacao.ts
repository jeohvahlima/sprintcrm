import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

async function getCompanyId(): Promise<string> {
  const { data, error } = await supabase.rpc("get_my_company_id");
  if (error) throw error;
  return data as unknown as string;
}

/* ============ F3.1 SDR Specializations ============ */
export type SDRNivel = "sdr1" | "sdr2" | "sdr3" | "sdr4";
export const SDR_NIVEIS: { key: SDRNivel; label: string; desc: string; color: string }[] = [
  { key: "sdr1", label: "SDR 1 — Lista Fria", desc: "Cold call, lista de prospecção bruta. Foco em volume.", color: "from-slate-500 to-slate-400" },
  { key: "sdr2", label: "SDR 2 — Inbound", desc: "Recebe leads aquecidos do marketing. Foco em qualificar.", color: "from-blue-500 to-cyan-400" },
  { key: "sdr3", label: "SDR 3 — Outbound Qualificado", desc: "Listas segmentadas + cadências múltiplas. Foco em decisor.", color: "from-violet-500 to-fuchsia-400" },
  { key: "sdr4", label: "SDR 4 — Closer Assistant", desc: "Apoia closer em contas estratégicas. Foco em conversão.", color: "from-emerald-500 to-green-400" },
];

export function useSDRSpecializations() {
  return useQuery({
    queryKey: ["sdr_specializations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sdr_specializations" as any).select("*");
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useSetSDRNivel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ user_id, nivel, observacoes }: { user_id: string; nivel: SDRNivel; observacoes?: string }) => {
      const company_id = await getCompanyId();
      const { error } = await supabase.from("sdr_specializations" as any)
        .upsert({ user_id, nivel, observacoes, company_id } as any, { onConflict: "company_id,user_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sdr_specializations"] }),
  });
}

/* ============ F3.2 Playbook Checklist ============ */
export const PLAYBOOK_ITEMS = [
  { key: "icp", label: "ICP documentado e versionado", ordem: 1 },
  { key: "script_abordagem", label: "Script de abordagem (cold call/WhatsApp)", ordem: 2 },
  { key: "script_qualificacao", label: "Script de qualificação (BANT/SPIN)", ordem: 3 },
  { key: "matriz_objecoes", label: "Matriz de objeções (TOP 10)", ordem: 4 },
  { key: "script_descoberta", label: "Roteiro de descoberta para reunião", ordem: 5 },
  { key: "script_apresentacao", label: "Apresentação / pitch de valor", ordem: 6 },
  { key: "script_fechamento", label: "Técnicas de fechamento documentadas", ordem: 7 },
  { key: "cadencia_followup", label: "Cadência de follow-up (7 toques / 14 dias)", ordem: 8 },
  { key: "regua_perda", label: "Régua de leads perdidos (recuperação)", ordem: 9 },
  { key: "onboarding_pos_venda", label: "Onboarding pós-venda padronizado", ordem: 10 },
];

export function usePlaybookChecklist() {
  return useQuery({
    queryKey: ["playbook_checklist"],
    queryFn: async () => {
      const { data, error } = await supabase.from("playbook_checklist" as any).select("*");
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useSavePlaybookItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: { item_key: string; item_label: string; status: string; link_documento?: string; observacoes?: string; ordem: number }) => {
      const company_id = await getCompanyId();
      const { error } = await supabase.from("playbook_checklist" as any)
        .upsert({ ...item, company_id } as any, { onConflict: "company_id,item_key" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["playbook_checklist"] }),
  });
}

/* ============ F3.3 CRM Maturity ============ */
export const CRM_CRITERIOS = [
  { key: "pipelines_definidos", label: "Pipelines com etapas claras e critérios objetivos" },
  { key: "lead_scoring", label: "Lead scoring ativo (qualificação automática)" },
  { key: "automacoes_ativas", label: "5+ automações de fluxo ativas" },
  { key: "tags_persistentes", label: "Sistema de tags / segmentação ativo" },
  { key: "integracao_whatsapp", label: "WhatsApp integrado (Meta ou Evolution)" },
  { key: "integracao_meta_ads", label: "Meta Ads / Pixel / CAPI configurado" },
  { key: "calendar_sincronizado", label: "Calendário sincronizado (Google/Outlook)" },
  { key: "dashboards_diarios", label: "Dashboards revisados diariamente" },
  { key: "previsao_receita", label: "Previsão de receita (forecast) configurada" },
  { key: "higienizacao_semanal", label: "Higienização semanal do pipeline" },
];

export function useCRMMaturity() {
  return useQuery({
    queryKey: ["crm_maturity"],
    queryFn: async () => {
      const { data, error } = await supabase.from("crm_maturity" as any).select("*").maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });
}

export function useSaveCRMMaturity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (criterios: Record<string, boolean>) => {
      const company_id = await getCompanyId();
      const score = Math.round((Object.values(criterios).filter(Boolean).length / CRM_CRITERIOS.length) * 100);
      const { error } = await supabase.from("crm_maturity" as any)
        .upsert({ company_id, criterios, score } as any, { onConflict: "company_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm_maturity"] }),
  });
}

/* ============ F3.4 AI Maturity ============ */
export type AINivel = "desligado" | "sugestivo" | "automatico";
export const AI_AGENTES = [
  { key: "atendimento", label: "Atendimento (chat com leads)" },
  { key: "qualificacao", label: "Qualificação (pré-venda / SDR)" },
  { key: "follow_up", label: "Follow-up automatizado" },
  { key: "respostas_rapidas", label: "Respostas rápidas / sugestões" },
  { key: "score_lead", label: "Lead scoring inteligente" },
];

export function useAIMaturity() {
  return useQuery({
    queryKey: ["ai_maturity"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ai_maturity" as any).select("*").maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });
}

export function useSaveAIMaturity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (agentes: Record<string, AINivel>) => {
      const company_id = await getCompanyId();
      const { error } = await supabase.from("ai_maturity" as any)
        .upsert({ company_id, agentes } as any, { onConflict: "company_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai_maturity"] }),
  });
}

/* ============ F4.1 Commercial HR ============ */
export interface CommercialHRConfig {
  funil_selecao: { etapas?: string; taxa_aprovacao?: string; tempo_medio_dias?: number };
  rampup: { plano_30?: string; plano_60?: string; plano_90?: string };
  remuneracao: { fixo?: number; variavel_meta?: number; comissao_percent?: number; aceleradores?: string };
  retencao: { turnover_mensal?: number; nps_interno?: number; plano_carreira?: string };
}

export function useCommercialHR() {
  return useQuery({
    queryKey: ["commercial_hr"],
    queryFn: async (): Promise<CommercialHRConfig> => {
      const { data, error } = await supabase.from("commercial_hr_config" as any).select("*").maybeSingle();
      if (error) throw error;
      const row = data as any;
      return {
        funil_selecao: row?.funil_selecao || {},
        rampup: row?.rampup || {},
        remuneracao: row?.remuneracao || {},
        retencao: row?.retencao || {},
      };
    },
  });
}

export function useSaveCommercialHR() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cfg: CommercialHRConfig) => {
      const company_id = await getCompanyId();
      const { error } = await supabase.from("commercial_hr_config" as any)
        .upsert({ company_id, ...cfg } as any, { onConflict: "company_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["commercial_hr"] }),
  });
}

/* ============ F4.2 Business Context ============ */
export type BusinessPhase = "validacao" | "tracao" | "escala";
export const BUSINESS_PHASES: { key: BusinessPhase; label: string; emoji: string; desc: string; color: string }[] = [
  { key: "validacao", label: "Validação", emoji: "🌱", desc: "Buscando product-market fit. Foco em aprendizado.", color: "from-rose-500 to-orange-400" },
  { key: "tracao", label: "Tração", emoji: "📈", desc: "PMF validado. Foco em previsibilidade.", color: "from-blue-500 to-cyan-400" },
  { key: "escala", label: "Escala", emoji: "🚀", desc: "Operação previsível. Foco em otimização e expansão.", color: "from-amber-500 to-yellow-400" },
];

export function useBusinessContext() {
  return useQuery({
    queryKey: ["business_context"],
    queryFn: async () => {
      const { data, error } = await supabase.from("business_context" as any).select("*").maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });
}

export function useSaveBusinessContext() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ctx: { fase?: BusinessPhase; modelo_negocio?: string; notas?: string }) => {
      const company_id = await getCompanyId();
      const { error } = await supabase.from("business_context" as any)
        .upsert({ company_id, ...ctx } as any, { onConflict: "company_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["business_context"] }),
  });
}

/* ============ F4.3 Prescriptive Diagnosis ============ */
export interface PrescriptiveRule {
  id: string;
  sintoma_key: string;
  sintoma_label: string;
  causa_provavel: string;
  acao_prescrita: string;
  modulo_destino: string | null;
  pilar: string | null;
  prioridade: number;
}

export function usePrescriptiveRules() {
  return useQuery({
    queryKey: ["prescriptive_rules"],
    queryFn: async () => {
      const { data, error } = await supabase.from("prescriptive_rules" as any)
        .select("*").eq("ativo", true).order("prioridade", { ascending: false });
      if (error) throw error;
      return (data as any[]) as PrescriptiveRule[];
    },
  });
}

export function useLogDiagnosis() {
  return useMutation({
    mutationFn: async ({ sintomas, acoes }: { sintomas: string[]; acoes: any[] }) => {
      const company_id = await getCompanyId();
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("prescriptive_diagnosis_log" as any).insert({
        company_id,
        user_id: user?.id,
        sintomas_keys: sintomas,
        acoes,
      } as any);
    },
  });
}
