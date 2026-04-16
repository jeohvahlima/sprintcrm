import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { CadenceManager } from "./CadenceManager";
import { CadenceProgressTracker } from "./CadenceProgressTracker";
import { ActionableAlerts } from "./ActionableAlerts";
import { ScriptsLibrary } from "./ScriptsLibrary";
import { ConversaPopup } from "@/components/leads/ConversaPopup";
import { 
  Brain,
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Flame, 
  Snowflake, 
  Sun,
  Target,
  Phone,
  MessageSquare,
  Calendar,
  ArrowRight,
  RefreshCw,
  Eye,
  CheckCircle,
  XCircle,
  Zap,
  BarChart3,
  Users,
  Clock,
  ThermometerSun,
  FileText
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface LeadIntelligence {
  id: string;
  lead_id: string;
  engagement_score: number;
  temperature: 'frio' | 'morno' | 'quente' | 'fechando';
  purchase_intent: number;
  conversation_sentiment: string;
  recommended_action: string;
  recommended_channel: string;
  next_action_date: string;
  objections: string[];
  days_since_last_contact: number;
  leads?: {
    id: string;
    name: string;
    phone?: string;
    email?: string;
    value?: number;
    funis?: { nome: string };
    etapas?: { nome: string; cor: string };
  };
}

interface CommercialAlert {
  id: string;
  lead_id: string;
  alert_type: string;
  severity: string;
  title: string;
  description: string;
  recommended_action: string;
  status: string;
  created_at: string;
}

interface DashboardStats {
  totalLeads: number;
  hotLeads: number;
  warmLeads: number;
  coldLeads: number;
  avgEngagement: number;
  avgPurchaseIntent: number;
  criticalAlerts: number;
  highAlerts: number;
  pendingAlerts: number;
  topObjections: { name: string; count: number }[];
}

export const CommercialIntelligenceDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [leadIntelligence, setLeadIntelligence] = useState<LeadIntelligence[]>([]);
  const [alerts, setAlerts] = useState<CommercialAlert[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [conversaPopupOpen, setConversaPopupOpen] = useState(false);
  const [selectedLeadForChat, setSelectedLeadForChat] = useState<{ id: string; name: string; phone?: string } | null>(null);

  const loadData = useCallback(async () => {
    try {
      // Buscar company_id
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: userRole } = await supabase
        .from("user_roles")
        .select("company_id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (!userRole?.company_id) return;
      setCompanyId(userRole.company_id);

      // Buscar inteligência dos leads
      const { data: intelligence } = await supabase
        .from("ia_lead_intelligence")
        .select(`
          *,
          leads:lead_id (
            id, name, phone, email, value,
            funis:funil_id (nome),
            etapas:etapa_id (nome, cor)
          )
        `)
        .eq("company_id", userRole.company_id)
        .order("engagement_score", { ascending: false })
        .limit(100);

      setLeadIntelligence((intelligence || []) as LeadIntelligence[]);

      // Buscar alertas
      const { data: alertsData } = await supabase
        .from("ia_commercial_alerts")
        .select("*")
        .eq("company_id", userRole.company_id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(50);

      setAlerts((alertsData || []) as CommercialAlert[]);

      // Calcular estatísticas
      const intel = (intelligence || []) as LeadIntelligence[];
      const alertsList = (alertsData || []) as CommercialAlert[];
      
      setStats({
        totalLeads: intel.length,
        hotLeads: intel.filter(i => i.temperature === "quente" || i.temperature === "fechando").length,
        warmLeads: intel.filter(i => i.temperature === "morno").length,
        coldLeads: intel.filter(i => i.temperature === "frio").length,
        avgEngagement: intel.length > 0 
          ? Math.round(intel.reduce((sum, i) => sum + (i.engagement_score || 0), 0) / intel.length)
          : 0,
        avgPurchaseIntent: intel.length > 0
          ? Math.round(intel.reduce((sum, i) => sum + (i.purchase_intent || 0), 0) / intel.length)
          : 0,
        criticalAlerts: alertsList.filter(a => a.severity === "critical").length,
        highAlerts: alertsList.filter(a => a.severity === "high").length,
        pendingAlerts: alertsList.length,
        topObjections: countObjections(intel),
      });

    } catch (error) {
      console.error("[CommercialIntelligenceDashboard] Erro:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    // Realtime subscription para alertas
    const channel = supabase
      .channel("ia-commercial-alerts")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ia_commercial_alerts" },
        () => loadData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ia_lead_intelligence" },
        () => loadData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  const runBatchAnalysis = async () => {
    if (!companyId) return;
    setRefreshing(true);

    try {
      const { data, error } = await supabase.functions.invoke("ia-analise-comercial", {
        body: { action: "analyze_batch", companyId }
      });

      if (error) throw error;
      toast.success(`Análise concluída: ${data.analyzed} leads analisados`);
      loadData();
    } catch (error) {
      console.error("[CommercialIntelligenceDashboard] Erro na análise:", error);
      toast.error("Erro ao executar análise");
    } finally {
      setRefreshing(false);
    }
  };

  const handleAlertAction = async (alertId: string, action: "seen" | "actioned" | "dismissed") => {
    try {
      const { error } = await supabase
        .from("ia_commercial_alerts")
        .update({ status: action, [`${action}_at`]: new Date().toISOString() })
        .eq("id", alertId);

      if (error) throw error;
      loadData();
    } catch (error) {
      toast.error("Erro ao atualizar alerta");
    }
  };

  const getTemperatureIcon = (temp: string) => {
    switch (temp) {
      case "fechando": return <Flame className="h-4 w-4 text-red-500" />;
      case "quente": return <Flame className="h-4 w-4 text-orange-500" />;
      case "morno": return <Sun className="h-4 w-4 text-yellow-500" />;
      default: return <Snowflake className="h-4 w-4 text-blue-500" />;
    }
  };

  const getTemperatureBadge = (temp: string) => {
    const variants: Record<string, string> = {
      fechando: "bg-red-100 text-red-800 border-red-200",
      quente: "bg-orange-100 text-orange-800 border-orange-200",
      morno: "bg-yellow-100 text-yellow-800 border-yellow-200",
      frio: "bg-blue-100 text-blue-800 border-blue-200",
    };
    return variants[temp] || variants.frio;
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "bg-red-500";
      case "high": return "bg-orange-500";
      case "medium": return "bg-yellow-500";
      default: return "bg-blue-500";
    }
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case "call": return <Phone className="h-4 w-4" />;
      case "whatsapp": return <MessageSquare className="h-4 w-4" />;
      case "email": return <MessageSquare className="h-4 w-4" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500">
            <Brain className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Inteligência Comercial</h2>
            <p className="text-sm text-muted-foreground">
              Análise em tempo real • Monitoramento 24/7
            </p>
          </div>
        </div>
        <Button 
          onClick={runBatchAnalysis} 
          disabled={refreshing}
          variant="outline"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? "Analisando..." : "Atualizar Análise"}
        </Button>
      </div>

      {/* KPIs Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total de Leads Monitorados */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Leads Monitorados</p>
                <p className="text-3xl font-bold">{stats?.totalLeads || 0}</p>
              </div>
              <div className="p-3 rounded-full bg-primary/10">
                <Users className="h-6 w-6 text-primary" />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Badge className="bg-red-100 text-red-800">
                <Flame className="h-3 w-3 mr-1" />
                {stats?.hotLeads || 0} quentes
              </Badge>
              <Badge className="bg-yellow-100 text-yellow-800">
                <Sun className="h-3 w-3 mr-1" />
                {stats?.warmLeads || 0} mornos
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Engajamento Médio */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Engajamento Médio</p>
                <p className="text-3xl font-bold">{stats?.avgEngagement || 0}%</p>
              </div>
              <div className="p-3 rounded-full bg-green-100">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <Progress value={stats?.avgEngagement || 0} className="mt-4" />
          </CardContent>
        </Card>

        {/* Intenção de Compra */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Intenção de Compra</p>
                <p className="text-3xl font-bold">{stats?.avgPurchaseIntent || 0}%</p>
              </div>
              <div className="p-3 rounded-full bg-blue-100">
                <Target className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <Progress value={stats?.avgPurchaseIntent || 0} className="mt-4" />
          </CardContent>
        </Card>

        {/* Alertas Pendentes */}
        <Card className={stats?.criticalAlerts ? "border-red-300 bg-red-50/50" : ""}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Alertas Pendentes</p>
                <p className="text-3xl font-bold">{stats?.pendingAlerts || 0}</p>
              </div>
              <div className={`p-3 rounded-full ${stats?.criticalAlerts ? 'bg-red-100' : 'bg-yellow-100'}`}>
                <AlertTriangle className={`h-6 w-6 ${stats?.criticalAlerts ? 'text-red-600' : 'text-yellow-600'}`} />
              </div>
            </div>
            {(stats?.criticalAlerts || 0) > 0 && (
              <Badge className="mt-4 bg-red-500 text-white">
                {stats?.criticalAlerts} críticos
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs de Conteúdo */}
      <Tabs defaultValue="cadences" className="space-y-4">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="cadences" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Cadências Ativas
          </TabsTrigger>
          <TabsTrigger value="scripts" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Scripts
          </TabsTrigger>
          <TabsTrigger value="alerts" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Alertas
            {(stats?.pendingAlerts || 0) > 0 && (
              <Badge variant="destructive" className="ml-1">
                {stats?.pendingAlerts}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="leads" className="flex items-center gap-2">
            <ThermometerSun className="h-4 w-4" />
            Leads
          </TabsTrigger>
          <TabsTrigger value="objections" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Objeções
          </TabsTrigger>
        </TabsList>

        {/* Tab: Cadências Ativas */}
        <TabsContent value="cadences">
          <CadenceProgressTracker />
        </TabsContent>

        {/* Tab: Scripts */}
        <TabsContent value="scripts">
          <ScriptsLibrary />
        </TabsContent>

        {/* Tab: Alertas Acionáveis */}
        <TabsContent value="alerts">
          <ActionableAlerts />
        </TabsContent>

        {/* Tab: Leads por Temperatura */}
        <TabsContent value="leads">
          <Card>
            <CardHeader>
              <CardTitle>Ranking de Leads por Engajamento</CardTitle>
              <CardDescription>
                Leads ordenados por score de engajamento e temperatura
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-3">
                  {leadIntelligence.map((intel) => (
                    <div
                      key={intel.id}
                      className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => {
                        if (!intel.lead_id) return;
                        setSelectedLeadForChat({
                          id: intel.lead_id,
                          name: intel.leads?.name || "Lead",
                          phone: intel.leads?.phone,
                        });
                        setConversaPopupOpen(true);
                      }}
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col items-center gap-1">
                          {getTemperatureIcon(intel.temperature)}
                          <span className="text-xs text-muted-foreground">{intel.engagement_score}%</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{intel.leads?.name || "Lead"}</span>
                            <Badge className={getTemperatureBadge(intel.temperature)}>
                              {intel.temperature}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            {intel.leads?.etapas && (
                              <span 
                                className="px-2 py-0.5 rounded text-xs"
                                style={{ backgroundColor: intel.leads.etapas.cor + "20", color: intel.leads.etapas.cor }}
                              >
                                {intel.leads.etapas.nome}
                              </span>
                            )}
                            {intel.days_since_last_contact > 0 && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {intel.days_since_last_contact}d sem contato
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-sm font-medium flex items-center gap-1">
                            {getChannelIcon(intel.recommended_channel)}
                            {intel.recommended_action}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Intenção: {intel.purchase_intent}%
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                  {leadIntelligence.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Nenhum lead analisado ainda</p>
                      <p className="text-sm">Clique em "Atualizar Análise" para começar</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Alertas */}
        <TabsContent value="alerts">
          <Card>
            <CardHeader>
              <CardTitle>Alertas de Inteligência Comercial</CardTitle>
              <CardDescription>
                Oportunidades e riscos detectados automaticamente
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-3">
                  {alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="p-4 rounded-lg border relative overflow-hidden"
                    >
                      <div className={`absolute left-0 top-0 bottom-0 w-1 ${getSeverityColor(alert.severity)}`} />
                      <div className="flex items-start justify-between ml-3">
                        <div>
                          <h4 className="font-medium">{alert.title}</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            {alert.description}
                          </p>
                          {alert.recommended_action && (
                            <Badge variant="outline" className="mt-2">
                              {alert.recommended_action}
                            </Badge>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleAlertAction(alert.id, "seen")}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-green-600"
                            onClick={() => handleAlertAction(alert.id, "actioned")}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600"
                            onClick={() => handleAlertAction(alert.id, "dismissed")}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {alerts.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50 text-green-500" />
                      <p>Nenhum alerta pendente</p>
                      <p className="text-sm">Tudo sob controle!</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Ações Recomendadas */}
        <TabsContent value="actions">
          <Card>
            <CardHeader>
              <CardTitle>Ações Recomendadas para Hoje</CardTitle>
              <CardDescription>
                Leads que precisam de ação imediata
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-3">
                  {leadIntelligence
                    .filter(i => i.next_action_date && new Date(i.next_action_date) <= new Date())
                    .slice(0, 20)
                    .map((intel) => (
                      <div
                        key={intel.id}
                        className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50"
                      >
                        <div className="flex items-center gap-4">
                          {getTemperatureIcon(intel.temperature)}
                          <div>
                            <span className="font-medium">{intel.leads?.name}</span>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                {getChannelIcon(intel.recommended_channel)}
                                via {intel.recommended_channel}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge>{intel.recommended_action}</Badge>
                          <Button
                            size="sm"
                            onClick={() => navigate(`/conversas?search=${intel.leads?.phone || intel.leads?.name}`)}
                          >
                            Agir <ArrowRight className="h-4 w-4 ml-1" />
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Objeções */}
        <TabsContent value="objections">
          <Card>
            <CardHeader>
              <CardTitle>Objeções Mais Comuns</CardTitle>
              <CardDescription>
                Ranking de objeções detectadas nas conversas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats?.topObjections?.map((obj, index) => (
                  <div key={obj.name} className="flex items-center gap-4">
                    <span className="text-2xl font-bold text-muted-foreground w-8">
                      #{index + 1}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium capitalize">{obj.name}</span>
                        <span className="text-sm text-muted-foreground">{obj.count} leads</span>
                      </div>
                      <Progress 
                        value={(obj.count / (stats?.totalLeads || 1)) * 100} 
                        className="h-2"
                      />
                    </div>
                  </div>
                ))}
                {(!stats?.topObjections || stats.topObjections.length === 0) && (
                  <div className="text-center py-12 text-muted-foreground">
                    <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma objeção detectada ainda</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {selectedLeadForChat && (
        <ConversaPopup
          open={conversaPopupOpen}
          onOpenChange={(isOpen) => {
            setConversaPopupOpen(isOpen);
            if (!isOpen) setSelectedLeadForChat(null);
          }}
          leadId={selectedLeadForChat.id}
          leadName={selectedLeadForChat.name}
          leadPhone={selectedLeadForChat.phone}
        />
      )}
    </div>
  );
};

function countObjections(intelligence: LeadIntelligence[]): { name: string; count: number }[] {
  const counts: Record<string, number> = {};
  
  for (const i of intelligence) {
    const objections = i.objections || [];
    for (const obj of objections) {
      counts[obj] = (counts[obj] || 0) + 1;
    }
  }
  
  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

export default CommercialIntelligenceDashboard;
