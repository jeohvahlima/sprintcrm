import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Target,
  FileText,
  Zap,
  BookOpen,
  Library,
  Stethoscope,
  Bot,
  ClipboardCheck,
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

export default function ProcessosComerciais() {
  const [activeTab, setActiveTab] = useState("intelligence");
  const [stats, setStats] = useState<Stats>({ alerts: 0, suggestions: 0 });
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    loadCompanyId();
  }, []);

  useEffect(() => {
    if (companyId) {
      loadStats();
    }
  }, [companyId]);

  const loadCompanyId = async () => {
    const { data } = await supabase.rpc('get_my_company_id');
    if (data) setCompanyId(data);
  };

  const loadStats = async () => {
    if (!companyId) return;
    
    const [alertsRes, suggestionsRes] = await Promise.all([
      supabase
        .from('ia_commercial_alerts')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('status', 'pending'),
      supabase
        .from('ai_process_suggestions')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('status', 'pending')
    ]);

    setStats({
      alerts: alertsRes.count || 0,
      suggestions: suggestionsRes.count || 0
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10">
              <Target className="h-8 w-8 text-primary" />
            </div>
            Processos Comerciais
          </h1>
          <p className="text-muted-foreground mt-1">Inteligência comercial, documentos, playbooks, cadências e processos do seu time</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="flex flex-wrap gap-2 h-auto p-1 bg-muted/50">
          <TabsTrigger value="intelligence" className="flex items-center gap-2 py-2 relative">
            <Zap className="h-4 w-4" />
            <span className="hidden md:inline">Inteligência Comercial</span>
            {stats.alerts > 0 && (
              <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {stats.alerts}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="workspace" className="flex items-center gap-2 py-2">
            <FileText className="h-4 w-4" />
            <span className="hidden md:inline">Workspace</span>
          </TabsTrigger>
          <TabsTrigger value="ebooks" className="flex items-center gap-2 py-2">
            <BookOpen className="h-4 w-4" />
            <span className="hidden md:inline">Playbooks Comerciais</span>
          </TabsTrigger>
          <TabsTrigger value="checklist" className="flex items-center gap-2 py-2">
            <ClipboardCheck className="h-4 w-4" />
            <span className="hidden md:inline">Checklist Playbook</span>
          </TabsTrigger>
          <TabsTrigger value="ia-maturity" className="flex items-center gap-2 py-2">
            <Bot className="h-4 w-4" />
            <span className="hidden md:inline">Maturidade IA</span>
          </TabsTrigger>
          <TabsTrigger value="diagnostico-prescritivo" className="flex items-center gap-2 py-2">
            <Stethoscope className="h-4 w-4" />
            <span className="hidden md:inline">Diagnóstico Prescritivo</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="intelligence">
          <CommercialIntelligenceDashboard />
        </TabsContent>

        <TabsContent value="workspace">
          <NotionWorkspace companyId={companyId} />
        </TabsContent>

        <TabsContent value="ebooks">
          <PlaybooksCatalog />
        </TabsContent>

        <TabsContent value="checklist">
          <PlaybookChecklist />
        </TabsContent>

        <TabsContent value="ia-maturity">
          <AIMaturityCheck />
        </TabsContent>

        <TabsContent value="diagnostico-prescritivo">
          <PrescriptiveDiagnosis />
        </TabsContent>

      </Tabs>
    </div>
  );
}
