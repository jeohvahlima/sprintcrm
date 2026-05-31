import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { toast } from "sonner";
import { Loader2, Save, Trash2, Target, User as UserIcon } from "lucide-react";

type Metric =
  | "gross_value"
  | "sales_closed"
  | "calls"
  | "meetings_scheduled"
  | "leads_prospected";

type Period = "daily" | "monthly";

interface GoalRow {
  id: string;
  user_id: string | null;
  metric: Metric;
  period: Period;
  target_value: number;
  active: boolean | null;
}

const METRICS: { key: Metric; label: string; period: Period; isCurrency?: boolean; icon: string }[] = [
  { key: "gross_value", label: "Faturamento mensal (R$)", period: "monthly", isCurrency: true, icon: "💰" },
  { key: "sales_closed", label: "Vendas fechadas no mês", period: "monthly", icon: "🏆" },
  { key: "calls", label: "Ligações por dia", period: "daily", icon: "📞" },
  { key: "meetings_scheduled", label: "Reuniões agendadas por dia", period: "daily", icon: "📅" },
  { key: "leads_prospected", label: "Leads prospectados por dia", period: "daily", icon: "🎯" },
];

export default function IndividualGoalsManager() {
  const { members, loading: loadingMembers } = useTeamMembers();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [values, setValues] = useState<Record<Metric, string>>({
    gross_value: "",
    sales_closed: "",
    calls: "",
    meetings_scheduled: "",
    leads_prospected: "",
  });
  const [existing, setExisting] = useState<GoalRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("user_roles")
        .select("company_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data?.company_id) setCompanyId(data.company_id);
    })();
  }, []);

  useEffect(() => {
    if (!selectedUser) {
      setExisting([]);
      setValues({ gross_value: "", sales_closed: "", calls: "", meetings_scheduled: "", leads_prospected: "" });
      return;
    }
    loadGoals(selectedUser);
  }, [selectedUser]);

  const loadGoals = async (uid: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("commercial_goals")
      .select("id, user_id, metric, period, target_value, active")
      .eq("user_id", uid)
      .eq("active", true);
    setLoading(false);
    if (error) {
      toast.error("Erro ao carregar metas");
      return;
    }
    const rows = (data || []) as GoalRow[];
    setExisting(rows);
    const next: Record<Metric, string> = { gross_value: "", sales_closed: "", calls: "", meetings_scheduled: "", leads_prospected: "" };
    rows.forEach((r) => {
      if (r.metric in next) next[r.metric as Metric] = String(r.target_value ?? "");
    });
    setValues(next);
  };

  const handleSave = async () => {
    if (!selectedUser || !companyId) {
      toast.error("Selecione um colaborador");
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const created_by = user?.id ?? null;

      for (const m of METRICS) {
        const raw = values[m.key]?.trim();
        const existingRow = existing.find((e) => e.metric === m.key && e.period === m.period);

        if (!raw || Number(raw) <= 0) {
          // delete if exists
          if (existingRow) {
            await supabase.from("commercial_goals").delete().eq("id", existingRow.id);
          }
          continue;
        }
        const target_value = Number(raw);
        if (existingRow) {
          await supabase
            .from("commercial_goals")
            .update({ target_value, active: true })
            .eq("id", existingRow.id);
        } else {
          await supabase.from("commercial_goals").insert({
            company_id: companyId,
            user_id: selectedUser,
            scope: "user",
            metric: m.key,
            period: m.period,
            target_value,
            active: true,
            created_by,
          });
        }
      }
      toast.success("Metas salvas");
      await loadGoals(selectedUser);
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleClearAll = async () => {
    if (!selectedUser) return;
    if (!confirm("Remover todas as metas individuais deste colaborador?")) return;
    const { error } = await supabase
      .from("commercial_goals")
      .delete()
      .eq("user_id", selectedUser);
    if (error) toast.error("Erro ao remover");
    else {
      toast.success("Metas removidas");
      await loadGoals(selectedUser);
    }
  };

  const selectedMember = useMemo(() => members.find((m) => m.id === selectedUser), [members, selectedUser]);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-200 bg-gradient-to-r from-emerald-50 to-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
            <Target className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Metas Individuais por Colaborador</h2>
            <p className="text-sm text-slate-500">Defina faturamento mensal e metas diárias de atividades. O colaborador verá na sua Rotina.</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-5">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Colaborador</label>
          {loadingMembers ? (
            <div className="flex items-center gap-2 text-slate-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Carregando equipe…</div>
          ) : (
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full md:w-96 border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Selecione um colaborador…</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name || m.email} {m.role ? `· ${m.role}` : ""}
                </option>
              ))}
            </select>
          )}
        </div>

        {selectedMember && (
          <>
            <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold">
                {(selectedMember.full_name || selectedMember.email || "?").charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold text-slate-900">{selectedMember.full_name || selectedMember.email}</div>
                <div className="text-xs text-slate-500 flex items-center gap-1"><UserIcon className="w-3 h-3" /> {selectedMember.email}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {METRICS.map((m) => (
                <div key={m.key} className="border border-slate-200 rounded-xl p-4 bg-white">
                  <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">
                    {m.icon} {m.label}
                  </label>
                  <div className="flex items-center gap-2">
                    {m.isCurrency && <span className="text-slate-500 text-sm">R$</span>}
                    <input
                      type="number"
                      min="0"
                      step={m.isCurrency ? "100" : "1"}
                      value={values[m.key]}
                      onChange={(e) => setValues((v) => ({ ...v, [m.key]: e.target.value }))}
                      placeholder="0"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5">
                    {m.period === "monthly" ? "Meta mensal" : "Meta diária"}
                  </p>
                </div>
              ))}
            </div>

            {loading && <div className="flex items-center gap-2 text-slate-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Carregando metas atuais…</div>}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                onClick={handleClearAll}
                disabled={saving || existing.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2.5 border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl text-sm font-semibold disabled:opacity-40"
              >
                <Trash2 className="w-4 h-4" /> Remover todas
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-xl text-sm font-bold disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar metas
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
