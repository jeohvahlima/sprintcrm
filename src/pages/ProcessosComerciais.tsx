import { useState, useEffect } from "react";
import {
  Target,
  FileText,
  Zap,
  BookOpen,
  Stethoscope,
  Bot,
  ClipboardCheck,
  Search,
  Plus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { NotionWorkspace } from "@/components/processos/notion/NotionWorkspace";
import { CommercialIntelligenceDashboard } from "@/components/ia/CommercialIntelligenceDashboard";
import { PlaybooksCatalog } from "@/components/processos/playbooks/PlaybooksCatalog";
import { PlaybookChecklist } from "@/components/processos/PlaybookChecklist";
import { AIMaturityCheck } from "@/components/processos/AIMaturityCheck";
import { PrescriptiveDiagnosis } from "@/components/processos/PrescriptiveDiagnosis";

interface Stats {
  alerts: number;
  suggestions: number;
}

type TabKey =
  | "intelligence"
  | "workspace"
  | "ebooks"
  | "checklist"
  | "ia-maturity"
  | "diagnostico-prescritivo";

const TABS: { key: TabKey; label: string; icon: typeof Zap }[] = [
  { key: "intelligence", label: "Inteligência Comercial", icon: Zap },
  { key: "workspace", label: "Workspace", icon: FileText },
  { key: "ebooks", label: "Playbooks Comerciais", icon: BookOpen },
  { key: "checklist", label: "Checklist Playbook", icon: ClipboardCheck },
  { key: "ia-maturity", label: "Maturidade IA", icon: Bot },
  { key: "diagnostico-prescritivo", label: "Diagnóstico Prescritivo", icon: Stethoscope },
];

export default function ProcessosComerciais() {
  const [activeTab, setActiveTab] = useState<TabKey>("intelligence");
  const [stats, setStats] = useState<Stats>({ alerts: 0, suggestions: 0 });
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("get_my_company_id");
      if (data) setCompanyId(data);
    })();
  }, []);

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      const [alertsRes, suggestionsRes] = await Promise.all([
        supabase
          .from("ia_commercial_alerts")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .eq("status", "pending"),
        supabase
          .from("ai_process_suggestions")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .eq("status", "pending"),
      ]);
      setStats({
        alerts: alertsRes.count || 0,
        suggestions: suggestionsRes.count || 0,
      });
    })();
  }, [companyId]);

  return (
    <div className="min-h-screen flex flex-col bg-[#0f1117] text-white">
      {/* Topbar */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2d3a]">
        <div className="flex items-center gap-3">
          <div className="w-[38px] h-[38px] rounded-[10px] bg-gradient-to-br from-[#16a34a] to-[#15803d] flex items-center justify-center">
            <Target className="h-[18px] w-[18px] text-white" />
          </div>
          <div>
            <div className="text-[17px] font-medium leading-tight">Processos Comerciais</div>
            <div className="text-[11px] text-[#6b7280] mt-0.5">
              Workspace de documentos · playbooks · scripts do time
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-[#1a1d27] text-[#9ca3af] border border-[#2a2d3a] hover:bg-[#2a2d3a] hover:text-white transition-colors">
            <Search className="h-3 w-3" />
            Buscar
          </button>
          <button className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-[#16a34a] text-white hover:bg-[#15803d] transition-colors">
            <Plus className="h-3 w-3" />
            Novo documento
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 px-5 py-3 border-b border-[#2a2d3a] overflow-x-auto">
        {TABS.map(({ key, label, icon: Icon }) => {
          const on = activeTab === key;
          const badge = key === "intelligence" && stats.alerts > 0 ? stats.alerts : null;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`relative flex items-center gap-1.5 px-5 py-2 rounded-lg text-[13px] font-medium whitespace-nowrap transition-all ${
                on
                  ? "bg-[#1a1d27] text-white border border-[#2a2d3a]"
                  : "text-[#6b7280] hover:text-white border border-transparent"
              }`}
            >
              <Icon className="h-[15px] w-[15px]" />
              {label}
              {on && <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] ml-1" />}
              {badge !== null && (
                <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-destructive text-[10px] font-semibold flex items-center justify-center">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto">
        {activeTab === "intelligence" && <CommercialIntelligenceDashboard />}
        {activeTab === "workspace" && <NotionWorkspace companyId={companyId} />}
        {activeTab === "ebooks" && <PlaybooksCatalog />}
        {activeTab === "checklist" && <PlaybookChecklist />}
        {activeTab === "ia-maturity" && <AIMaturityCheck />}
        {activeTab === "diagnostico-prescritivo" && <PrescriptiveDiagnosis />}
      </div>
    </div>
  );
}
