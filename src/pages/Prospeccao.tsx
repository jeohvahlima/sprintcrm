import { useEffect, useRef, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus, Download, FileText, UserPlus, Settings, Volume2, VolumeX, PanelRightClose, PanelRightOpen, Table as TableIcon, LayoutGrid } from "lucide-react";
import { PipelineFunnelVisual } from "@/components/prospeccao/PipelineFunnelVisual";
import { QuickActionCards } from "@/components/prospeccao/QuickActionCards";
import { ProspeccaoKanbanView } from "@/components/prospeccao/ProspeccaoKanbanView";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ProspeccaoKPIs } from "@/components/prospeccao/ProspeccaoKPIs";
import { ProspeccaoTable } from "@/components/prospeccao/ProspeccaoTable";
import { ProspeccaoCharts } from "@/components/prospeccao/ProspeccaoCharts";
import { ProspeccaoFormDialog } from "@/components/prospeccao/ProspeccaoFormDialog";
import { FollowUpTable } from "@/components/prospeccao/FollowUpTable";
import { FollowUpKPIs } from "@/components/prospeccao/FollowUpKPIs";
import { FollowUpFormDialog } from "@/components/prospeccao/FollowUpFormDialog";
import { BenchmarkPanel } from "@/components/prospeccao/BenchmarkPanel";
import { InteractionLogDialog } from "@/components/prospeccao/InteractionLogDialog";
import { InteractionTimeline } from "@/components/prospeccao/InteractionTimeline";
import { ScriptLibrary } from "@/components/prospeccao/ScriptLibrary";
import { useProspeccaoData } from "@/hooks/useProspeccaoData";
import { useFollowUpData } from "@/hooks/useFollowUpData";
import { useInteractions } from "@/hooks/useInteractions";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePlayerProfile } from "@/hooks/usePlayerProfile";
import { useGamificationConfig } from "@/hooks/useGamificationConfig";
import { PlayerHeaderCard } from "@/components/prospeccao/rpg/PlayerHeaderCard";
import { QuestBoard } from "@/components/prospeccao/rpg/QuestBoard";
import { WeeklyLeaderboard } from "@/components/prospeccao/rpg/WeeklyLeaderboard";
import { AchievementsGallery } from "@/components/prospeccao/rpg/AchievementsGallery";
import { RankLadder } from "@/components/prospeccao/rpg/RankLadder";
import { LevelUpModal } from "@/components/prospeccao/rpg/LevelUpModal";
// ClassicVsRpgToggle removido — visual unificado corporativo
import { RewardShop } from "@/components/prospeccao/rpg/RewardShop";
import { ArenaTopBar } from "@/components/prospeccao/rpg/ArenaTopBar";
import { TeamLobbyPanel } from "@/components/prospeccao/rpg/TeamLobbyPanel";
import { KillFeed } from "@/components/prospeccao/rpg/KillFeed";
import { ChannelProspectPanel } from "@/components/prospeccao/channels/ChannelProspectPanel";
import { ProspectingIntelligencePanel } from "@/components/prospeccao/ProspectingIntelligencePanel";
import { GoalProgressHUD } from "@/components/prospeccao/comercial/GoalProgressHUD";
import { CloserInbox } from "@/components/prospeccao/comercial/CloserInbox";
import { ManagerCommandCenter } from "@/components/prospeccao/comercial/ManagerCommandCenter";
import { SDRQueuePanel } from "@/components/prospeccao/comercial/SDRQueuePanel";
import { SocialSellingPanel } from "@/components/prospeccao/SocialSellingPanel";
import { usePermissions } from "@/hooks/usePermissions";

const RPG_KEY = "prospeccao_rpg_mode";
const SOUND_KEY = "prospeccao_rpg_sound";


export default function Prospeccao() {
  const isMobile = useIsMobile();
  const [rpgMode, setRpgMode] = useState<boolean>(() => localStorage.getItem(RPG_KEY) !== "false");
  const [soundOn, setSoundOn] = useState<boolean>(() => localStorage.getItem(SOUND_KEY) === "true");
  const [activeTab, setActiveTab] = useState<"organic" | "paid" | "followup" | "arena" | "coldcall" | "instagram" | "whatsapp" | "funil" | "closer" | "comando" | "fila" | "intel" | "social">("organic");
  const [subTab, setSubTab] = useState<"registros" | "interacoes">("registros");
  const [channelView, setChannelView] = useState<"prospect" | "chat">("prospect");
  const [instagramSub, setInstagramSub] = useState<"chat" | "social">("chat");
  const [period, setPeriod] = useState("30");
  const [showForm, setShowForm] = useState(false);
  const [showFollowUpForm, setShowFollowUpForm] = useState(false);
  const [showInteractionForm, setShowInteractionForm] = useState(false);
  const [showScripts, setShowScripts] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [showRanks, setShowRanks] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [newLevel] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => localStorage.getItem("prospeccao_sidebar") !== "false");
  const [recordsView, setRecordsView] = useState<"table" | "kanban">("table");
  const [activeFunnelStage, setActiveFunnelStage] = useState<string | null>(null);
  useEffect(() => { localStorage.setItem("prospeccao_sidebar", String(sidebarOpen)); }, [sidebarOpen]);

  useEffect(() => { localStorage.setItem(RPG_KEY, String(rpgMode)); }, [rpgMode]);
  useEffect(() => { localStorage.setItem(SOUND_KEY, String(soundOn)); }, [soundOn]);

  const isChannelTab = activeTab === "coldcall" || activeTab === "instagram" || activeTab === "whatsapp";
  const isFunilTab = activeTab === "funil";
  const isCloserTab = activeTab === "closer";
  const isComandoTab = activeTab === "comando";
  const isFilaTab = activeTab === "fila";
  const isIntelTab = activeTab === "intel";
  const isSocialTab = activeTab === "social";
  const channelType = activeTab === "followup" || activeTab === "arena" || isChannelTab || isFunilTab || isCloserTab || isComandoTab || isFilaTab || isIntelTab || isSocialTab ? "organic" : activeTab;
  const { data, isLoading, refetch } = useProspeccaoData(channelType as "organic" | "paid", parseInt(period));
  const { data: followUpData, isLoading: followUpLoading, refetch: followUpRefetch } = useFollowUpData(parseInt(period));

  const interactionLogType = activeTab === "followup" ? "followup" : "prospecting";
  const { data: interactions, isLoading: interactionsLoading, refetch: interactionsRefetch } = useInteractions(
    interactionLogType as "prospecting" | "followup",
    parseInt(period)
  );

  const { data: profile, userId, companyId } = usePlayerProfile();
  const { data: gamificationCfg } = useGamificationConfig(companyId);
  const gamificationOn = rpgMode && (gamificationCfg?.enabled ?? true);
  const { isAdmin, userRoles } = usePermissions();
  const isManagerLike = isAdmin || userRoles.some((r) => r.role === "gestor");

  // Detect level up — toast discreto em vez de modal full-screen
  const lastLevel = useRef<number | null>(null);
  useEffect(() => {
    if (!profile) return;
    if (lastLevel.current !== null && profile.level > lastLevel.current) {
      toast.success(`🎉 Você subiu para o Nível ${profile.level}!`, {
        description: "Continue assim — sua evolução está sendo registrada.",
      });
    }
    lastLevel.current = profile.level;
  }, [profile?.level]);

  const handleExportCSV = () => {
    if (activeTab === "followup") {
      if (!followUpData || followUpData.length === 0) return;
      const headers = "Data,Responsável,Canal,Follow-ups,Respostas,%Resp,Reuniões,%Reun,Vendas,Ticket,Bruto";
      const rows = followUpData.map((r) => {
        const ticket = r.sales_closed > 0 ? (r.gross_value / r.sales_closed).toFixed(2) : "0";
        const pResp = r.followups_sent > 0 ? ((r.responses / r.followups_sent) * 100).toFixed(1) : "0";
        const pReun = r.responses > 0 ? ((r.meetings_scheduled / r.responses) * 100).toFixed(1) : "0";
        return `${r.log_date},${r.user_name || ""},${r.source || ""},${r.followups_sent},${r.responses},${pResp}%,${r.meetings_scheduled},${pReun}%,${r.sales_closed},${ticket},${r.gross_value}`;
      });
      downloadCSV([headers, ...rows].join("\n"), `followup_${new Date().toISOString().slice(0, 10)}.csv`);
      return;
    }
    if (!data || data.length === 0) return;
    const isPaid = activeTab === "paid";
    const headers = isPaid
      ? "Data,Responsável,Fonte,Gasto,Leads,CPL,Oportunidades,CPO,Reuniões,Vendas,CPV,Ticket Médio,Bruto,ROI"
      : "Data,Responsável,Fonte,Leads,Oportunidades,Reuniões,Vendas,Ticket Médio,Bruto";
    const rows = data.map((r) => {
      const ticket = r.sales_closed > 0 ? (r.gross_value / r.sales_closed).toFixed(2) : "0";
      if (!isPaid) return `${r.log_date},${r.user_name || ""},${r.source || ""},${r.leads_prospected},${r.opportunities},${r.meetings_scheduled},${r.sales_closed},${ticket},${r.gross_value}`;
      const cpl = r.leads_prospected > 0 ? (r.ad_spend / r.leads_prospected).toFixed(2) : "0";
      const cpo = r.opportunities > 0 ? (r.ad_spend / r.opportunities).toFixed(2) : "0";
      const cpv = r.sales_closed > 0 ? (r.ad_spend / r.sales_closed).toFixed(2) : "0";
      const roi = r.ad_spend > 0 ? (((r.gross_value - r.ad_spend) / r.ad_spend) * 100).toFixed(1) : "0";
      return `${r.log_date},${r.user_name || ""},${r.source || ""},${r.ad_spend},${r.leads_prospected},${cpl},${r.opportunities},${cpo},${r.meetings_scheduled},${r.sales_closed},${cpv},${ticket},${r.gross_value},${roi}%`;
    });
    downloadCSV([headers, ...rows].join("\n"), `prospeccao_${activeTab}_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const downloadCSV = (csv: string, name: string) => {
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  };

  const handleRegister = () => {
    if (activeTab === "followup") setShowFollowUpForm(true);
    else if (activeTab !== "arena") setShowForm(true);
  };

  const handleRefreshAll = () => {
    if (activeTab === "followup") followUpRefetch();
    else refetch();
    interactionsRefetch();
  };

  const labels: Record<string, string> = {
    organic: "Visão Geral",
    paid: "Pipeline Pago",
    followup: "Follow-ups",
    arena: "Ranking",
    coldcall: "Cold Call",
    instagram: "Instagram",
    whatsapp: "WhatsApp",
    funil: "Funil de Vendas",
    closer: "Leads Qualificados",
    comando: "Painel do Gestor",
    fila: "Minha Fila",
    intel: "Inteligência",
    social: "Social Selling",
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      {gamificationOn && <KillFeed companyId={companyId} enableSound={soundOn} />}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Prospecção Comercial</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe metas, pipeline e performance da equipe de vendas
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 dias</SelectItem>
              <SelectItem value="15">15 dias</SelectItem>
              <SelectItem value="30">30 dias</SelectItem>
              <SelectItem value="60">60 dias</SelectItem>
              <SelectItem value="90">90 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSidebarOpen((s) => !s)}
            title={sidebarOpen ? "Recolher painel lateral" : "Expandir painel lateral"}
          >
            {sidebarOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
          </Button>
          {gamificationOn && (
            <>
              <Button size="sm" variant="ghost" onClick={() => setSoundOn((s) => !s)} title={soundOn ? "Desligar som" : "Ligar som"}>
                {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </Button>
              <Button size="sm" variant="ghost" asChild>
                <Link to="/configuracoes/gamificacao"><Settings className="h-4 w-4" /></Link>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Cards de Ação Rápida */}
      <QuickActionCards
        onRegister={handleRegister}
        onInteraction={() => setShowInteractionForm(true)}
        onScripts={() => setShowScripts(true)}
        onExport={handleExportCSV}
      />

      {/* Arena ao vivo (topo) */}
      {gamificationOn && <ArenaTopBar companyId={companyId} currentUserId={userId} />}

      {/* Player Header (modo RPG) */}
      {gamificationOn && (
        <PlayerHeaderCard
          profile={profile}
          onShowAchievements={() => setShowAchievements(true)}
          onShowRanks={() => setShowRanks(true)}
        />
      )}

      {/* HUD de Metas Comerciais — sempre visível */}
      <GoalProgressHUD period="daily" />

      <div className={`flex gap-6 ${isMobile ? "flex-col" : ""}`}>
        <div className="flex-1 min-w-0">
          <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as any); setSubTab("registros"); }}>
            <TabsList className="flex flex-wrap h-auto">
              <TabsTrigger value="organic">{labels.organic}</TabsTrigger>
              <TabsTrigger value="paid">{labels.paid}</TabsTrigger>
              <TabsTrigger value="followup">{labels.followup}</TabsTrigger>
              <TabsTrigger value="fila">{labels.fila}</TabsTrigger>
              <TabsTrigger value="coldcall">{labels.coldcall}</TabsTrigger>
              <TabsTrigger value="instagram">{labels.instagram}</TabsTrigger>
              <TabsTrigger value="whatsapp">{labels.whatsapp}</TabsTrigger>
              <TabsTrigger value="funil">{labels.funil}</TabsTrigger>
              <TabsTrigger value="closer">{labels.closer}</TabsTrigger>
              {isManagerLike && <TabsTrigger value="comando">{labels.comando}</TabsTrigger>}
              <TabsTrigger value="intel">✨ {labels.intel}</TabsTrigger>
              {gamificationOn && <TabsTrigger value="arena">{labels.arena}</TabsTrigger>}
            </TabsList>

            {activeTab !== "arena" && !isChannelTab && !isFunilTab && !isCloserTab && !isComandoTab && !isFilaTab && !isIntelTab && !isSocialTab && (
              <div className="flex gap-1 mt-3 mb-4">
                <Button variant={subTab === "registros" ? "default" : "ghost"} size="sm" onClick={() => setSubTab("registros")}>Registros</Button>
                <Button variant={subTab === "interacoes" ? "default" : "ghost"} size="sm" onClick={() => setSubTab("interacoes")}>
                  Interações ({interactions?.length || 0})
                </Button>
              </div>
            )}

            {isSocialTab ? (
              <div className="mt-4">
                <SocialSellingPanel />
              </div>
            ) : isIntelTab ? (
              <div className="mt-4">
                <ProspectingIntelligencePanel />
              </div>
            ) : isFilaTab ? (
              <div className="mt-4">
                <SDRQueuePanel />
              </div>
            ) : isCloserTab ? (
              <div className="mt-4">
                <CloserInbox />
              </div>
            ) : isComandoTab ? (
              <div className="mt-4">
                <ManagerCommandCenter />
              </div>
            ) : activeTab === "arena" ? (
              <div className="space-y-6 mt-4">
                <WeeklyLeaderboard companyId={companyId} currentUserId={userId} />
                <div className="bg-card border border-border rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-foreground mb-3">🏆 Conquistas e Trilha de Carreira</h3>
                  <Button variant="outline" onClick={() => setShowAchievements(true)}>Abrir Galeria</Button>
                  <Button variant="outline" className="ml-2" onClick={() => setShowRanks(true)}>Ver Ranks</Button>
                </div>
                {gamificationCfg?.shop_enabled && (
                  <RewardShop companyId={companyId} userCoins={profile?.coins ?? 0} />
                )}
              </div>
            ) : isChannelTab ? (
              <div className="mt-4 space-y-3">
                {activeTab === "instagram" ? (
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex gap-1">
                      <Button
                        variant={instagramSub === "chat" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setInstagramSub("chat")}
                      >
                        💬 Bate-papo
                      </Button>
                      <Button
                        variant={instagramSub === "social" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setInstagramSub("social")}
                      >
                        🚀 Social Selling
                      </Button>
                    </div>
                    {instagramSub === "chat" && (
                      <Button variant="outline" size="sm" asChild>
                        <Link to="/conversas?channel=instagram" target="_blank" rel="noopener noreferrer">
                          Abrir em nova aba
                        </Link>
                      </Button>
                    )}
                  </div>
                ) : activeTab === "whatsapp" && (
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex gap-1">
                      <Button
                        variant={channelView === "prospect" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setChannelView("prospect")}
                      >
                        🎯 Prospecção
                      </Button>
                      <Button
                        variant={channelView === "chat" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setChannelView("chat")}
                      >
                        💬 Bate-papo
                      </Button>
                    </div>
                    {channelView === "chat" && (
                      <Button variant="outline" size="sm" asChild>
                        <Link
                          to="/conversas?channel=whatsapp"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Abrir em nova aba
                        </Link>
                      </Button>
                    )}
                  </div>
                )}
                {activeTab === "instagram" && instagramSub === "social" ? (
                  <SocialSellingPanel />
                ) : activeTab === "instagram" || (channelView === "chat" && activeTab === "whatsapp") ? (
                  <div
                    className="rounded-lg border border-border overflow-hidden bg-background"
                    style={{ height: "calc(100vh - 360px)", minHeight: 600 }}
                  >
                    <iframe
                      src={`/conversas?channel=${activeTab === "instagram" ? "instagram" : "whatsapp"}&embed=1`}
                      title={`Bate-papo ${activeTab}`}
                      className="w-full h-full border-0"
                    />
                  </div>
                ) : (
                  <ChannelProspectPanel channel={activeTab as "coldcall" | "instagram" | "whatsapp"} />
                )}
              </div>
            ) : isFunilTab ? (
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-sm text-muted-foreground">
                    Espelho do Funil de Vendas — arraste leads entre etapas em tempo real.
                  </p>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/kanban" target="_blank" rel="noopener noreferrer">
                      Abrir em nova aba
                    </Link>
                  </Button>
                </div>
                <div className="rounded-lg border border-border overflow-hidden bg-background" style={{ height: "calc(100vh - 320px)", minHeight: 600 }}>
                  <iframe
                    src="/kanban?embed=1"
                    title="Funil de Vendas"
                    className="w-full h-full border-0"
                  />
                </div>
              </div>
            ) : subTab === "interacoes" ? (
              <div className="space-y-6">
                <InteractionTimeline data={interactions || []} isLoading={interactionsLoading} onRefresh={interactionsRefetch} />
              </div>
            ) : (
              <>
                <TabsContent value="organic" className="space-y-6 mt-0">
                  <PipelineFunnelVisual
                    data={data || []}
                    isLoading={isLoading}
                    activeStage={activeFunnelStage}
                    onStageClick={setActiveFunnelStage}
                  />
                  <ProspeccaoKPIs data={data || []} channelType="organic" isLoading={isLoading} />
                  <ProspeccaoCharts data={data || []} channelType="organic" />
                  <RecordsViewToggle view={recordsView} onChange={setRecordsView} />
                  {recordsView === "table" ? (
                    <ProspeccaoTable data={data || []} channelType="organic" isLoading={isLoading} onRefresh={refetch} />
                  ) : (
                    <ProspeccaoKanbanView data={data || []} />
                  )}
                </TabsContent>
                <TabsContent value="paid" className="space-y-6 mt-0">
                  <PipelineFunnelVisual
                    data={data || []}
                    isLoading={isLoading}
                    activeStage={activeFunnelStage}
                    onStageClick={setActiveFunnelStage}
                  />
                  <ProspeccaoKPIs data={data || []} channelType="paid" isLoading={isLoading} />
                  <ProspeccaoCharts data={data || []} channelType="paid" />
                  <RecordsViewToggle view={recordsView} onChange={setRecordsView} />
                  {recordsView === "table" ? (
                    <ProspeccaoTable data={data || []} channelType="paid" isLoading={isLoading} onRefresh={refetch} />
                  ) : (
                    <ProspeccaoKanbanView data={data || []} />
                  )}
                </TabsContent>
                <TabsContent value="followup" className="space-y-6 mt-0">
                  <FollowUpKPIs data={followUpData || []} isLoading={followUpLoading} />
                  <FollowUpTable data={followUpData || []} isLoading={followUpLoading} onRefresh={followUpRefetch} />
                </TabsContent>
              </>
            )}
          </Tabs>
        </div>

        {sidebarOpen && (
          <div className={`${isMobile ? "w-full" : "w-72 shrink-0"} space-y-4 animate-in slide-in-from-right-4 duration-200`}>
            {gamificationOn ? (
              <>
                <QuestBoard userId={userId} companyId={companyId} />
                <TeamLobbyPanel companyId={companyId} currentUserId={userId} />
                <WeeklyLeaderboard companyId={companyId} currentUserId={userId} />
              </>
            ) : (
              <BenchmarkPanel />
            )}
          </div>
        )}
      </div>

      <ProspeccaoFormDialog open={showForm} onOpenChange={setShowForm} channelType={channelType as "organic" | "paid"} onSuccess={handleRefreshAll} />
      <FollowUpFormDialog open={showFollowUpForm} onOpenChange={setShowFollowUpForm} onSuccess={handleRefreshAll} />
      <InteractionLogDialog open={showInteractionForm} onOpenChange={setShowInteractionForm} logType={interactionLogType as "prospecting" | "followup"} onSuccess={handleRefreshAll} />
      <ScriptLibrary open={showScripts} onOpenChange={setShowScripts} />

      {gamificationOn && (
        <>
          <AchievementsGallery open={showAchievements} onOpenChange={setShowAchievements} userId={userId} />
          <RankLadder open={showRanks} onOpenChange={setShowRanks} currentLevel={profile?.level ?? 1} />
          <LevelUpModal open={showLevelUp} onOpenChange={setShowLevelUp} newLevel={newLevel} />
        </>
      )}
    </div>
  );
}

function RecordsViewToggle({ view, onChange }: { view: "table" | "kanban"; onChange: (v: "table" | "kanban") => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-sm font-semibold text-foreground">Registros</h3>
      <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5">
        <Button
          size="sm"
          variant={view === "table" ? "default" : "ghost"}
          className="h-7 px-3 text-xs"
          onClick={() => onChange("table")}
        >
          <TableIcon className="h-3.5 w-3.5 mr-1" /> Tabela
        </Button>
        <Button
          size="sm"
          variant={view === "kanban" ? "default" : "ghost"}
          className="h-7 px-3 text-xs"
          onClick={() => onChange("kanban")}
        >
          <LayoutGrid className="h-3.5 w-3.5 mr-1" /> Kanban
        </Button>
      </div>
    </div>
  );
}
