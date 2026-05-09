import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface RevenueSummary {
  period_start: string;
  period_end: string;
  total_leads: number;
  leads_pagos: number;
  leads_organicos: number;
  ganhos: number;
  perdidos: number;
  receita_total: number;
  ticket_medio: number;
  taxa_conversao: number;
  top_origem: string;
}

export interface CampaignMetric {
  campaign_key: string;
  campaign_id: string | null;
  campaign_name: string;
  ad_id: string | null;
  ad_creative_name: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  source_type: string | null;
  total_leads: number;
  novos: number;
  em_contato: number;
  qualificados: number;
  agendados: number;
  ganhos: number;
  perdidos: number;
  receita_total: number;
  ticket_medio: number;
  taxa_conversao: number;
  // enriched from Meta
  spend?: number;
  impressions?: number;
  clicks?: number;
  cpl?: number;
  roi?: number;
}

export interface BottleneckRow {
  etapa_id: string;
  etapa_nome: string;
  total_leads: number;
  leads_parados: number;
  dias_medio_parado: number;
  receita_potencial: number;
}

export function useRevenueEngineMetrics(companyId: string | null, days: number = 30) {
  const [summary, setSummary] = useState<RevenueSummary | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignMetric[]>([]);
  const [bottlenecks, setBottlenecks] = useState<BottleneckRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - days);
      const startStr = start.toISOString().slice(0, 10);
      const endStr = end.toISOString().slice(0, 10);

      const [sumRes, metRes, botRes] = await Promise.all([
        supabase.rpc("get_revenue_engine_summary", { p_company_id: companyId, p_start_date: startStr, p_end_date: endStr }),
        supabase.rpc("get_revenue_engine_metrics", { p_company_id: companyId, p_start_date: startStr, p_end_date: endStr }),
        supabase.rpc("get_revenue_engine_bottlenecks", { p_company_id: companyId, p_start_date: startStr, p_end_date: endStr }),
      ]);

      if (sumRes.error) throw sumRes.error;
      if (metRes.error) throw metRes.error;
      if (botRes.error) throw botRes.error;

      setSummary(sumRes.data as unknown as RevenueSummary);
      const baseCampaigns = (metRes.data || []) as CampaignMetric[];

      // Enrich with Meta Ads spend
      try {
        const datePresetMap: Record<number, string> = { 7: "last_7d", 14: "last_14d", 30: "last_30d", 90: "last_90d" };
        const preset = datePresetMap[days] || "last_30d";
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meta-marketing-insights?company_id=${companyId}&date_preset=${preset}`;
          const r = await fetch(url, { headers: { Authorization: `Bearer ${session.access_token}` } });
          if (r.ok) {
            const meta = await r.json();
            const byId = new Map<string, any>();
            (meta.campaigns || []).forEach((c: any) => byId.set(String(c.id), c));
            const enriched = baseCampaigns.map((c) => {
              const m = c.campaign_id ? byId.get(String(c.campaign_id)) : null;
              const spend = m?.spend ?? 0;
              const cpl = c.total_leads > 0 ? spend / c.total_leads : 0;
              const roi = spend > 0 ? (c.receita_total - spend) / spend : 0;
              return { ...c, spend, impressions: m?.impressions ?? 0, clicks: m?.clicks ?? 0, cpl, roi };
            });
            setCampaigns(enriched);
          } else {
            setCampaigns(baseCampaigns);
          }
        } else {
          setCampaigns(baseCampaigns);
        }
      } catch (e) {
        console.warn("[RevenueEngine] meta enrich failed:", e);
        setCampaigns(baseCampaigns);
      }

      setBottlenecks((botRes.data || []) as BottleneckRow[]);
    } catch (e: any) {
      console.error("[useRevenueEngine] error:", e);
      setError(e?.message || "Erro ao carregar Revenue Engine");
    } finally {
      setLoading(false);
    }
  }, [companyId, days]);

  useEffect(() => {
    load();
  }, [load]);

  return { summary, campaigns, bottlenecks, loading, error, reload: load };
}
