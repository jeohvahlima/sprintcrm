import { useState, useEffect } from "react";
import {
  Target,
  FileText,
  BookOpen,
  Search,
  Plus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { NotionWorkspace } from "@/components/processos/notion/NotionWorkspace";
import { PlaybooksCatalog } from "@/components/processos/playbooks/PlaybooksCatalog";

type TabKey = "workspace" | "ebooks";

const TABS: { key: TabKey; label: string; icon: typeof FileText }[] = [
  { key: "workspace", label: "Workspace", icon: FileText },
  { key: "ebooks", label: "Playbooks Comerciais", icon: BookOpen },
];

export default function ProcessosComerciais() {
  const [activeTab, setActiveTab] = useState<TabKey>("workspace");
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("get_my_company_id");
      if (data) setCompanyId(data);
    })();
  }, []);

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
            </button>
          );
        })}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto">
        {activeTab === "workspace" && <NotionWorkspace companyId={companyId} />}
        {activeTab === "ebooks" && <PlaybooksCatalog />}
      </div>
    </div>
  );
}
