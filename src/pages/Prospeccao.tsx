import { useEffect, useRef, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus, Download, FileText, UserPlus, Settings } from "lucide-react";
import { Link } from "react-router-dom";
import confetti from "canvas-confetti";
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
import { ClassicVsRpgToggle } from "@/components/prospeccao/rpg/ClassicVsRpgToggle";
import { RewardShop } from "@/components/prospeccao/rpg/RewardShop";

const RPG_KEY = "prospeccao_rpg_mode";

export default function Prospeccao() {
  const isMobile = useIsMobile();
  const [rpgMode, setRpgMode] = useState<boolean>(() => localStorage.getItem(RPG_KEY) !== "false");
  const [activeTab, setActiveTab] = useState<"organic" | "paid" | "followup" | "arena">("organic");
  const [subTab, setSubTab] = useState<"registros" | "interacoes">("registros");
  const [period, setPeriod] = useState("30");
  const [showForm, setShowForm] = useState(false);
  const [showFollowUpForm, setShowFollowUpForm] = useState(false);
  const [showInteractionForm, setShowInteractionForm] = useState(false);
  const [showScripts, setShowScripts] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [showRanks, setShowRanks] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [newLevel, setNewLevel] = useState(0);

  useEffect(() => { localStorage.setItem(RPG_KEY, String(rpgMode)); }, [rpgMode]);

  const channelType = activeTab === "followup" || activeTab === "arena" ? "organic" : activeTab;
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

  // Detect level up via realtime profile
  const lastLevel = useRef<number | null>(null);
  useEffect(() => {
    if (!profile) return;
    if (lastLevel.current !== null && profile.level > lastLevel.current) {
      setNewLevel(profile.level);
      setShowLevelUp(true);
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
    // small celebration on every register
    if (gamificationOn) {
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 }, colors: ["#00f0ff", "#ff2bd6", "#7a3cff"] });
    }
  };

  const RPG_TAB_LABELS: Record<string, string> = {
    organic: "⚔️ Caçada",
    paid: "💰 Mercenário",
    followup: "📜 Reforço",
    arena: "🏆 Arena",
  };
  const CLASSIC_TAB_LABELS: Record<string, string> = {
    organic: "Orgânico",
    paid: "Tráfego Pago",
    followup: "Follow-Up",
    arena: "Ranking",
  };
  const labels = gamificationOn ? RPG_TAB_LABELS : CLASSIC_TAB_LABELS;

  return (
    <div className={`space-y-6 p-4 md:p-6 ${gamificationOn ? "rpg-grid-bg min-h-screen" : ""}`}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {gamificationOn ? "🎮 Sales Quest · Prospecção" : "Acompanhamento de Prospecção"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {gamificationOn
              ? "Cace leads, complete missões, suba de nível"
              : "Acompanhe o funil de prospecção, tráfego pago e follow-up"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ClassicVsRpgToggle rpgMode={rpgMode} onChange={setRpgMode} />
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
          <Button variant="outline" size="sm" onClick={() => setShowScripts(true)}>
            <FileText className="h-4 w-4 mr-1" /> {gamificationOn ? "Grimório" : "Scripts"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowInteractionForm(true)}>
            <UserPlus className="h-4 w-4 mr-1" /> Interação
          </Button>
          <Button size="sm" onClick={handleRegister}>
            <Plus className="h-4 w-4 mr-1" /> Registrar
          </Button>
          {gamificationOn && (
            <Button size="sm" variant="ghost" asChild>
              <Link to="/configuracoes/gamificacao"><Settings className="h-4 w-4" /></Link>
            </Button>
          )}
        </div>
      </div>

      {/* Player Header (modo RPG) */}
      {gamificationOn && (
        <PlayerHeaderCard
          profile={profile}
          onShowAchievements={() => setShowAchievements(true)}
          onShowRanks={() => setShowRanks(true)}
        />
      )}

      <div className={`flex gap-6 ${isMobile ? "flex-col" : ""}`}>
        <div className="flex-1 min-w-0">
          <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as any); setSubTab("registros"); }}>
            <TabsList>
              <TabsTrigger value="organic">{labels.organic}</TabsTrigger>
              <TabsTrigger value="paid">{labels.paid}</TabsTrigger>
              <TabsTrigger value="followup">{labels.followup}</TabsTrigger>
              {gamificationOn && <TabsTrigger value="arena">{labels.arena}</TabsTrigger>}
            </TabsList>

            {activeTab !== "arena" && (
              <div className="flex gap-1 mt-3 mb-4">
                <Button variant={subTab === "registros" ? "default" : "ghost"} size="sm" onClick={() => setSubTab("registros")}>Registros</Button>
                <Button variant={subTab === "interacoes" ? "default" : "ghost"} size="sm" onClick={() => setSubTab("interacoes")}>
                  Interações ({interactions?.length || 0})
                </Button>
              </div>
            )}

            {activeTab === "arena" ? (
              <div className="space-y-6 mt-4">
                <WeeklyLeaderboard companyId={companyId} currentUserId={userId} />
                <div className="rpg-card rounded-lg p-4">
                  <h3 className="rpg-text-mono text-sm uppercase tracking-wider rpg-neon-cyan mb-3">🏆 Conquistas</h3>
                  <Button variant="outline" onClick={() => setShowAchievements(true)}>Abrir Galeria</Button>
                  <Button variant="outline" className="ml-2" onClick={() => setShowRanks(true)}>Ver Ranks</Button>
                </div>
                {gamificationCfg?.shop_enabled && (
                  <RewardShop companyId={companyId} userCoins={profile?.coins ?? 0} />
                )}
              </div>
            ) : subTab === "interacoes" ? (
              <div className="space-y-6">
                <InteractionTimeline data={interactions || []} isLoading={interactionsLoading} onRefresh={interactionsRefetch} />
              </div>
            ) : (
              <>
                <TabsContent value="organic" className="space-y-6 mt-0">
                  <ProspeccaoKPIs data={data || []} channelType="organic" isLoading={isLoading} />
                  <ProspeccaoCharts data={data || []} channelType="organic" />
                  <ProspeccaoTable data={data || []} channelType="organic" isLoading={isLoading} onRefresh={refetch} />
                </TabsContent>
                <TabsContent value="paid" className="space-y-6 mt-0">
                  <ProspeccaoKPIs data={data || []} channelType="paid" isLoading={isLoading} />
                  <ProspeccaoCharts data={data || []} channelType="paid" />
                  <ProspeccaoTable data={data || []} channelType="paid" isLoading={isLoading} onRefresh={refetch} />
                </TabsContent>
                <TabsContent value="followup" className="space-y-6 mt-0">
                  <FollowUpKPIs data={followUpData || []} isLoading={followUpLoading} />
                  <FollowUpTable data={followUpData || []} isLoading={followUpLoading} onRefresh={followUpRefetch} />
                </TabsContent>
              </>
            )}
          </Tabs>
        </div>

        <div className={`${isMobile ? "w-full" : "w-72 shrink-0"} space-y-4`}>
          {gamificationOn ? (
            <>
              <QuestBoard userId={userId} companyId={companyId} />
              <WeeklyLeaderboard companyId={companyId} currentUserId={userId} />
            </>
          ) : (
            <BenchmarkPanel />
          )}
        </div>
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
