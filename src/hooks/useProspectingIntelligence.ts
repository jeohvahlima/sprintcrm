import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ============ ICP Profiles ============
export interface ICPCriterion {
  key: string;
  label: string;
  weight: number; // 0-100, soma == 100
  options: { value: string; label: string; score: number }[]; // score 0-100
}

export interface ICPIntelligence {
  profile?: any;
  buying_behavior?: any;
  pains?: any;
  desires?: string[];
  beliefs?: any;
  decision_map?: any;
  channel_strategy?: any;
  prospecting_strategy?: any;
  action_plan?: any;
  product_fit?: any;
  scoring?: any;
  lead_score_criteria?: ICPCriterion[];
}

export interface ICPProfile {
  id: string;
  company_id: string;
  name: string;
  is_default: boolean;
  criteria: ICPCriterion[];
  hot_threshold: number;
  warm_threshold: number;
  source?: "manual" | "ai";
  niche?: string;
  intelligence?: ICPIntelligence;
  fit_score?: number;
  generated_at?: string;
}

export function useGenerateICPIntelligence() {
  return useMutation({
    mutationFn: async (input: string | { niche: string; segmento?: string; produtos?: any[] }) => {
      const body = typeof input === "string" ? { niche: input } : input;

      // fetch direto com timeout maior (geração pode levar até ~60s)
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string) || "";
      const ANON_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) || "";

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 90000);

      try {
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/generate-icp-intelligence`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: ANON_KEY,
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        clearTimeout(timer);

        const text = await resp.text();
        let json: any = null;
        try { json = text ? JSON.parse(text) : null; } catch { /* ignore */ }

        if (!resp.ok) {
          const msg = json?.error || `Erro ${resp.status} ao gerar ICP`;
          throw new Error(msg);
        }
        if (json?.error) throw new Error(json.error);
        return json as { niche: string; intelligence: ICPIntelligence };
      } catch (e: any) {
        clearTimeout(timer);
        if (e?.name === "AbortError") {
          throw new Error("A geração demorou mais de 90s. Tente novamente.");
        }
        throw e;
      }
    },
  });
}

export function useICPProfiles() {
  return useQuery({
    queryKey: ["icp_profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("icp_profiles" as any)
        .select("*")
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ICPProfile[];
    },
  });
}

export function useSaveICPProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (profile: Partial<ICPProfile> & { id?: string }) => {
      const { data: companyId } = await supabase.rpc("get_my_company_id");
      const payload: any = { ...profile, company_id: companyId };
      if (profile.id) {
        const { error } = await supabase.from("icp_profiles" as any).update(payload).eq("id", profile.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("icp_profiles" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["icp_profiles"] }),
  });
}

// ============ Sales Machine Calculator ============
export interface SalesMachineConfig {
  id?: string;
  name: string;
  revenue_goal: number;
  ticket_medio: number;
  win_rate: number;
  meeting_show_rate: number;
  lead_to_meeting_rate: number;
  cycle_days: number;
  pipeline_coverage: number;
  sdr_capacity_per_day: number;
  closer_capacity_per_day: number;
  // Cached outputs
  sales_needed?: number;
  meetings_needed?: number;
  leads_needed?: number;
  pipeline_value?: number;
  sdrs_needed?: number;
  closers_needed?: number;
}

export function calcSalesMachine(c: SalesMachineConfig) {
  const sales = c.ticket_medio > 0 ? Math.ceil(c.revenue_goal / c.ticket_medio) : 0;
  const winRate = Math.max(c.win_rate, 0.0001) / 100;
  const showRate = Math.max(c.meeting_show_rate, 0.0001) / 100;
  const leadRate = Math.max(c.lead_to_meeting_rate, 0.0001) / 100;
  const meetingsHeldNeeded = Math.ceil(sales / winRate);
  const meetingsScheduledNeeded = Math.ceil(meetingsHeldNeeded / showRate);
  const leads = Math.ceil(meetingsScheduledNeeded / leadRate);
  const pipeline = c.revenue_goal * c.pipeline_coverage;
  const workingDays = Math.max(c.cycle_days, 1);
  const sdrs = c.sdr_capacity_per_day > 0 ? +(leads / (c.sdr_capacity_per_day * workingDays)).toFixed(2) : 0;
  const closers = c.closer_capacity_per_day > 0 ? +(meetingsScheduledNeeded / (c.closer_capacity_per_day * workingDays)).toFixed(2) : 0;
  return {
    sales_needed: sales,
    meetings_needed: meetingsScheduledNeeded,
    leads_needed: leads,
    pipeline_value: pipeline,
    sdrs_needed: sdrs,
    closers_needed: closers,
  };
}

export function useSalesMachineConfigs() {
  return useQuery({
    queryKey: ["sales_machine_configs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_machine_configs" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as SalesMachineConfig[];
    },
  });
}

export function useSaveSalesMachine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (config: SalesMachineConfig) => {
      const { data: companyId } = await supabase.rpc("get_my_company_id");
      const calc = calcSalesMachine(config);
      const payload: any = { ...config, ...calc, company_id: companyId };
      if (config.id) {
        const { error } = await supabase.from("sales_machine_configs" as any).update(payload).eq("id", config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("sales_machine_configs" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sales_machine_configs"] }),
  });
}

// ============ Lead Scores ============
export function useLeadScores(filter?: { temperature?: string; limit?: number }) {
  return useQuery({
    queryKey: ["lead_scores", filter],
    queryFn: async () => {
      let q = supabase
        .from("lead_scores" as any)
        .select("*, leads:lead_id(id,name,phone,email,source)")
        .order("total_score", { ascending: false })
        .limit(filter?.limit || 50);
      if (filter?.temperature) q = q.eq("temperature", filter.temperature);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as any[];
    },
  });
}
