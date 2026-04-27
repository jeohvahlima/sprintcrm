import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ============ Commission Plans ============
export interface CommissionPlan {
  id?: string;
  name: string;
  role: "sdr" | "closer" | "gestor";
  base_salary: number;
  ote_target: number;
  variable_pct: number;
  quota_monthly: number;
  commission_pct: number;
  accelerator_threshold: number;
  accelerator_multiplier: number;
  stage_kickers: Record<string, number>;
  is_active: boolean;
}

export function useCommissionPlans() {
  return useQuery({
    queryKey: ["commission_plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commission_plans" as any)
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as CommissionPlan[];
    },
  });
}

export function useSaveCommissionPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (plan: CommissionPlan) => {
      const { data: companyId } = await supabase.rpc("get_my_company_id");
      const payload: any = { ...plan, company_id: companyId };
      if (plan.id) {
        const { error } = await supabase.from("commission_plans" as any).update(payload).eq("id", plan.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("commission_plans" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["commission_plans"] }),
  });
}

export function calcCommission(plan: CommissionPlan, achievementPct: number, salesValue: number) {
  const monthlyVariable = (plan.ote_target / 12) * (plan.variable_pct / 100);
  const baseCommission = salesValue * (plan.commission_pct / 100);
  const aboveThreshold = achievementPct >= plan.accelerator_threshold;
  const accelerated = aboveThreshold
    ? baseCommission * plan.accelerator_multiplier
    : baseCommission;
  // Pro-rata para atingimento parcial: usa o maior entre comissão por % e atingimento × variável-alvo
  const targetBased = monthlyVariable * (achievementPct / 100);
  const payout = Math.max(accelerated, targetBased);
  const totalEarnings = (plan.base_salary) + payout;
  return {
    monthlyVariable,
    baseCommission,
    accelerated,
    payout,
    totalEarnings,
    aboveThreshold,
  };
}

// ============ Playbook Adoption ============
export function usePlaybookAdoption() {
  return useQuery({
    queryKey: ["playbook_adoption"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("playbook_adoption" as any)
        .select("*");
      if (error) throw error;
      return (data || []) as any[];
    },
  });
}

export function usePlaybookAdoptionStats() {
  return useQuery({
    queryKey: ["playbook_adoption_stats"],
    queryFn: async () => {
      const { data: adoption, error: e1 } = await supabase
        .from("playbook_adoption" as any)
        .select("playbook_id, user_id, applied_count");
      if (e1) throw e1;

      // 1) Templates oficiais da biblioteca (apenas templates globais + os da empresa)
      const { data: templates, error: tplErr } = await supabase
        .from("advisory_playbooks" as any)
        .select("id, title, category, is_template, company_id")
        .order("created_at", { ascending: false });
      if (tplErr) console.warn("[playbooks] erro templates:", tplErr);

      // 2) Playbooks customizados (Workspace) - páginas com tipo playbook
      const { data: customPages } = await supabase
        .from("process_pages" as any)
        .select("id, title, icon, page_type, properties, created_at")
        .order("created_at", { ascending: false })
        .limit(100);

      const customPlaybooks = (customPages || []).filter((p: any) => {
        const isPb = p.page_type === "playbook" ||
          (p.properties && (p.properties.kind === "playbook" || p.properties.type === "playbook"));
        const titleHints = ["playbook", "script", "cadência", "cadencia", "objeç", "discovery", "fechamento"];
        const titleMatch = p.title && titleHints.some((h) => p.title.toLowerCase().includes(h));
        return isPb || titleMatch;
      });

      // Combinar todos
      const playbooks = [
        ...(templates || []).map((t: any) => ({
          id: t.id,
          title: t.title,
          category: t.category,
          source: "template" as const,
          icon: "📘",
        })),
        ...customPlaybooks.map((p: any) => ({
          id: p.id,
          title: p.title || "Sem título",
          category: "custom",
          source: "custom" as const,
          icon: p.icon || "📝",
        })),
      ];

      const byPlaybook: Record<string, { views: number; applies: number }> = {};
      (adoption || []).forEach((a: any) => {
        if (!byPlaybook[a.playbook_id]) byPlaybook[a.playbook_id] = { views: 0, applies: 0 };
        byPlaybook[a.playbook_id].views += 1;
        byPlaybook[a.playbook_id].applies += a.applied_count || 0;
      });

      return {
        adoption: adoption || [],
        playbooks,
        templates: templates || [],
        customPlaybooks,
        byPlaybook,
      };
    },
  });
}

export async function trackPlaybookView(playbookId: string) {
  const { data: companyId } = await supabase.rpc("get_my_company_id");
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user || !companyId) return;
  await supabase.from("playbook_adoption" as any).upsert({
    company_id: companyId,
    playbook_id: playbookId,
    user_id: session.user.id,
    viewed_at: new Date().toISOString(),
  }, { onConflict: "playbook_id,user_id" });
}

export async function trackPlaybookApply(playbookId: string) {
  const { data: companyId } = await supabase.rpc("get_my_company_id");
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user || !companyId) return;
  // Increment applied_count
  const { data: existing } = await supabase
    .from("playbook_adoption" as any)
    .select("id, applied_count")
    .eq("playbook_id", playbookId)
    .eq("user_id", session.user.id)
    .maybeSingle();
  if (existing) {
    await supabase.from("playbook_adoption" as any).update({
      applied_count: ((existing as any).applied_count || 0) + 1,
      last_applied_at: new Date().toISOString(),
    }).eq("id", (existing as any).id);
  } else {
    await supabase.from("playbook_adoption" as any).insert({
      company_id: companyId,
      playbook_id: playbookId,
      user_id: session.user.id,
      applied_count: 1,
      last_applied_at: new Date().toISOString(),
    });
  }
}
