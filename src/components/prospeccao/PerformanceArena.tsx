import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Crown, Trophy, Medal, Award, Target, Sparkles, TrendingUp, Phone, Flame, Star, ChevronUp } from "lucide-react";
import type { RankPlayer } from "./PerformanceRankBoard";

const money = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n || 0);

// Árvore de progressão com ramificação SDR vs Closer
const TREE = {
  root: { key: "iniciante", label: "Iniciante", min: 0, icon: Target, color: "#94a3b8" },
  branches: {
    sdr: [
      { key: "sdr_bronze",   label: "SDR Bronze",   min: 20,  icon: Award,  color: "#f97316", metric: "reuniões" },
      { key: "sdr_prata",    label: "SDR Prata",    min: 60,  icon: Medal,  color: "#94a3b8", metric: "reuniões" },
      { key: "sdr_ouro",     label: "SDR Ouro",     min: 120, icon: Trophy, color: "#f59e0b", metric: "reuniões" },
      { key: "sdr_diamante", label: "SDR Diamante", min: 240, icon: Crown,  color: "#06b6d4", metric: "reuniões" },
    ],
    closer: [
      { key: "closer_bronze",   label: "Closer Bronze",   min: 5000,   icon: Award,  color: "#f97316", metric: "faturamento" },
      { key: "closer_prata",    label: "Closer Prata",    min: 20000,  icon: Medal,  color: "#94a3b8", metric: "faturamento" },
      { key: "closer_ouro",     label: "Closer Ouro",     min: 50000,  icon: Trophy, color: "#f59e0b", metric: "faturamento" },
      { key: "closer_diamante", label: "Closer Diamante", min: 100000, icon: Crown,  color: "#06b6d4", metric: "faturamento" },
    ],
  },
};

type NodeInfo = { key: string; label: string; min: number; color: string; metric: string };

function nodeForPlayer(p: RankPlayer): NodeInfo & { branch: "sdr" | "closer" | "root" } {
  const isSdr = p.role === "sdr" || (p.role === "hibrido" && p.reunioes > p.vendas);
  const branch = isSdr ? "sdr" : p.role === "closer" || p.role === "hibrido" ? "closer" : "root";
  const metric = isSdr ? p.reunioes : p.faturamento;
  if (branch === "root") return { ...TREE.root, branch: "root", metric: "geral" };
  const path = TREE.branches[branch];
  let current: any = { ...TREE.root, metric: branch === "sdr" ? "reuniões" : "faturamento" };
  for (const node of path) if (metric >= node.min) current = node;
  return { ...current, branch };
}

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

interface Props {
  players: RankPlayer[];
}

export function PerformanceArena({ players }: Props) {
  const [view, setView] = useState<"podio" | "arvore" | "escada">("podio");

  const sdrs = useMemo(
    () => players.filter((p) => p.role === "sdr" || p.role === "hibrido")
      .sort((a, b) => b.reunioes - a.reunioes || b.leads - a.leads),
    [players],
  );
  const closers = useMemo(
    () => players.filter((p) => p.role === "closer" || p.role === "hibrido")
      .sort((a, b) => b.faturamento - a.faturamento),
    [players],
  );

  const playersByNode = useMemo(() => {
    const map = new Map<string, RankPlayer[]>();
    players.forEach((p) => {
      const n = nodeForPlayer(p);
      const arr = map.get(n.key) || [];
      arr.push(p);
      map.set(n.key, arr);
    });
    return map;
  }, [players]);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3 border-b bg-gradient-to-br from-amber-500/10 via-primary/5 to-transparent">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" /> Arena de Performance
            </CardTitle>
            <CardDescription className="text-xs">
              Pódio, árvore de carreira ramificada e escada de evolução do time comercial.
            </CardDescription>
          </div>
          <Tabs value={view} onValueChange={(v) => setView(v as any)}>
            <TabsList className="h-8">
              <TabsTrigger value="podio" className="text-xs h-6"><Crown className="h-3 w-3 mr-1" />Pódio</TabsTrigger>
              <TabsTrigger value="arvore" className="text-xs h-6"><Star className="h-3 w-3 mr-1" />Árvore</TabsTrigger>
              <TabsTrigger value="escada" className="text-xs h-6"><ChevronUp className="h-3 w-3 mr-1" />Escada</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>

      <CardContent className="pt-5">
        {view === "podio" && <PodioView sdrs={sdrs} closers={closers} />}
        {view === "arvore" && <ArvoreView playersByNode={playersByNode} />}
        {view === "escada" && <EscadaView players={players} />}
      </CardContent>
    </Card>
  );
}

/* ---------------- Pódio ---------------- */
function PodioView({ sdrs, closers }: { sdrs: RankPlayer[]; closers: RankPlayer[] }) {
  return (
    <Tabs defaultValue="closers">
      <TabsList className="mb-4">
        <TabsTrigger value="closers" className="text-xs"><Trophy className="h-3.5 w-3.5 mr-1" />Closers</TabsTrigger>
        <TabsTrigger value="sdrs" className="text-xs"><Phone className="h-3.5 w-3.5 mr-1" />SDRs</TabsTrigger>
      </TabsList>

      <TabsContent value="closers"><Podium list={closers} metric="faturamento" /></TabsContent>
      <TabsContent value="sdrs"><Podium list={sdrs} metric="reunioes" /></TabsContent>
    </Tabs>
  );
}

function Podium({ list, metric }: { list: RankPlayer[]; metric: "faturamento" | "reunioes" }) {
  const top3 = list.slice(0, 3);
  const rest = list.slice(3, 10);
  const order = [top3[1], top3[0], top3[2]].filter(Boolean);
  const heights = ["h-28", "h-36", "h-24"];
  const colors = [
    "from-slate-300 to-slate-500",
    "from-amber-400 to-yellow-600",
    "from-orange-500 to-orange-700",
  ];
  const placeFor = (p: RankPlayer) => list.indexOf(p) + 1;

  if (top3.length === 0) {
    return <div className="text-sm text-muted-foreground text-center py-12">Sem dados de performance no período.</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-center gap-3 md:gap-6 px-4 pt-6">
        {order.map((p) => {
          const place = placeFor(p);
          const idx = place - 1;
          const value = metric === "faturamento" ? money(p.faturamento) : `${p.reunioes} reuniões`;
          return (
            <div key={p.user_id} className="flex flex-col items-center gap-2 flex-1 max-w-[180px]">
              {place === 1 && <Crown className="h-6 w-6 text-amber-500 -mb-1 animate-pulse" />}
              <Avatar className={`h-14 w-14 border-2 ${place === 1 ? "border-amber-500 ring-2 ring-amber-500/30" : "border-border"}`}>
                <AvatarFallback className="text-sm font-bold">{initials(p.name)}</AvatarFallback>
              </Avatar>
              <div className="text-xs font-semibold text-center truncate w-full">{p.name}</div>
              <div className="text-[10px] text-muted-foreground uppercase">{p.role}</div>
              <div className={`w-full ${heights[idx]} rounded-t-lg bg-gradient-to-b ${colors[idx]} flex flex-col items-center justify-start pt-2 text-white shadow-lg`}>
                <span className="text-2xl font-black">{place}º</span>
                <span className="text-[10px] mt-1 px-1 text-center font-semibold">{value}</span>
              </div>
            </div>
          );
        })}
      </div>

      {rest.length > 0 && (
        <div className="border-t pt-3">
          <div className="text-[10px] uppercase text-muted-foreground mb-2 tracking-wider">Demais posições</div>
          <div className="space-y-1.5">
            {rest.map((p, i) => {
              const value = metric === "faturamento" ? money(p.faturamento) : `${p.reunioes} reuniões`;
              return (
                <div key={p.user_id} className="flex items-center gap-3 p-2 rounded border bg-card">
                  <span className="text-xs font-bold text-muted-foreground w-7">{i + 4}º</span>
                  <Avatar className="h-7 w-7"><AvatarFallback className="text-[10px]">{initials(p.name)}</AvatarFallback></Avatar>
                  <span className="text-sm font-medium flex-1 truncate">{p.name}</span>
                  <span className="text-xs font-bold text-primary">{value}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Árvore Genealógica ---------------- */
function ArvoreView({ playersByNode }: { playersByNode: Map<string, RankPlayer[]> }) {
  const renderNode = (node: NodeInfo & { icon?: any }, side: "left" | "right" | "center") => {
    const list = playersByNode.get(node.key) || [];
    const Icon = (node as any).icon || Target;
    return (
      <div
        className={`relative rounded-xl border-2 p-3 bg-card transition hover:scale-[1.02] hover:shadow-lg ${
          list.length > 0 ? "border-primary/60 shadow-md" : "border-dashed border-muted opacity-80"
        }`}
        style={{ borderColor: list.length > 0 ? node.color : undefined }}
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="rounded-full p-1.5" style={{ backgroundColor: `${node.color}20`, color: node.color }}>
            <Icon className="h-3.5 w-3.5" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wide">{node.label}</span>
          <Badge variant="secondary" className="ml-auto text-[10px] h-5">{list.length}</Badge>
        </div>
        <div className="text-[10px] text-muted-foreground mb-2">
          {node.metric === "faturamento" ? `≥ ${money(node.min)}` : node.metric === "geral" ? "Ponto de partida" : `≥ ${node.min} ${node.metric}`}
        </div>
        {list.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {list.slice(0, 6).map((p) => (
              <div key={p.user_id} className="flex items-center gap-1.5 bg-muted/50 rounded-full pl-0.5 pr-2 py-0.5" title={p.name}>
                <Avatar className="h-5 w-5"><AvatarFallback className="text-[8px]">{initials(p.name)}</AvatarFallback></Avatar>
                <span className="text-[10px] font-medium truncate max-w-[70px]">{p.name.split(" ")[0]}</span>
              </div>
            ))}
            {list.length > 6 && <Badge variant="outline" className="text-[9px] h-5">+{list.length - 6}</Badge>}
          </div>
        ) : (
          <div className="text-[10px] text-muted-foreground italic">Vazio</div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Raiz */}
      <div className="flex justify-center">
        <div className="w-full max-w-xs">{renderNode({ ...TREE.root, metric: "geral" } as any, "center")}</div>
      </div>

      {/* Conector raiz → ramos */}
      <div className="flex justify-center">
        <svg width="100%" height="40" viewBox="0 0 600 40" preserveAspectRatio="none" className="max-w-2xl">
          <path d="M 300 0 L 300 15 L 100 15 L 100 40" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/40" strokeDasharray="4 4" />
          <path d="M 300 0 L 300 15 L 500 15 L 500 40" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/40" strokeDasharray="4 4" />
        </svg>
      </div>

      {/* Dois ramos lado a lado */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div className="text-center">
            <Badge className="bg-blue-500/15 text-blue-600 border-blue-500/30">
              <Phone className="h-3 w-3 mr-1" /> Trilha SDR · Prospecção
            </Badge>
          </div>
          {TREE.branches.sdr.map((n, i) => (
            <div key={n.key} className="relative">
              {renderNode(n as any, "left")}
              {i < TREE.branches.sdr.length - 1 && (
                <div className="flex justify-center py-1">
                  <ChevronUp className="h-4 w-4 text-muted-foreground/40 rotate-180" />
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="space-y-3">
          <div className="text-center">
            <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">
              <Trophy className="h-3 w-3 mr-1" /> Trilha Closer · Fechamento
            </Badge>
          </div>
          {TREE.branches.closer.map((n, i) => (
            <div key={n.key} className="relative">
              {renderNode(n as any, "right")}
              {i < TREE.branches.closer.length - 1 && (
                <div className="flex justify-center py-1">
                  <ChevronUp className="h-4 w-4 text-muted-foreground/40 rotate-180" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 justify-center pt-2 border-t">
        <Sparkles className="h-3 w-3" />
        Cada vendedor avança automaticamente conforme atinge as marcas de reuniões (SDR) ou faturamento (Closer).
      </div>
    </div>
  );
}

/* ---------------- Escada de Evolução ---------------- */
function EscadaView({ players }: { players: RankPlayer[] }) {
  const enriched = players
    .map((p) => ({ p, node: nodeForPlayer(p) }))
    .sort((a, b) => b.node.min - a.node.min || b.p.faturamento - a.p.faturamento);

  if (enriched.length === 0) {
    return <div className="text-sm text-muted-foreground text-center py-12">Sem vendedores ativos no período.</div>;
  }

  return (
    <div className="space-y-3">
      {enriched.map(({ p, node }, i) => {
        const allLevels = node.branch === "sdr"
          ? TREE.branches.sdr
          : node.branch === "closer"
          ? TREE.branches.closer
          : TREE.branches.closer;
        const currentIdx = allLevels.findIndex((l) => l.key === node.key);
        const stepReached = node.key === "iniciante" ? 0 : currentIdx + 1;
        const totalSteps = allLevels.length;
        const next = allLevels[Math.min(currentIdx + 1, totalSteps - 1)];
        const currentMetric = node.branch === "sdr" ? p.reunioes : p.faturamento;
        const nextProgress = next ? Math.min(100, (currentMetric / next.min) * 100) : 100;

        return (
          <div key={p.user_id} className="rounded-lg border bg-card p-3">
            <div className="flex items-center gap-3 mb-3">
              <div className="text-xs font-bold text-muted-foreground w-6">{i + 1}º</div>
              <Avatar className="h-9 w-9"><AvatarFallback className="text-xs">{initials(p.name)}</AvatarFallback></Avatar>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{p.name}</div>
                <div className="text-[10px] text-muted-foreground uppercase flex items-center gap-1.5">
                  {p.role}
                  <span>·</span>
                  <span style={{ color: node.color }} className="font-bold">{node.label}</span>
                </div>
              </div>
              <Badge style={{ backgroundColor: `${node.color}20`, color: node.color, borderColor: `${node.color}50` }} variant="outline" className="text-[10px]">
                Nv {stepReached}/{totalSteps}
              </Badge>
            </div>

            {/* Escada visual */}
            <div className="flex items-end gap-1 h-12 mb-2">
              {allLevels.map((lvl, idx) => {
                const reached = idx < stepReached;
                const current = idx === stepReached - 1;
                return (
                  <div
                    key={lvl.key}
                    className={`flex-1 rounded-t border transition ${reached ? "" : "bg-muted/30"} ${current ? "ring-2 ring-primary" : ""}`}
                    style={{
                      height: `${20 + idx * 18}%`,
                      backgroundColor: reached ? lvl.color : undefined,
                      borderColor: reached ? lvl.color : undefined,
                    }}
                    title={lvl.label}
                  />
                );
              })}
            </div>

            {next && stepReached < totalSteps && (
              <div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                  <span className="flex items-center gap-1"><Flame className="h-3 w-3 text-orange-500" /> Próximo: {next.label}</span>
                  <span className="font-semibold">
                    {node.branch === "sdr"
                      ? `${p.reunioes}/${next.min} reuniões`
                      : `${money(p.faturamento)} / ${money(next.min)}`}
                  </span>
                </div>
                <Progress value={nextProgress} className="h-1.5" />
              </div>
            )}
            {!next || stepReached >= totalSteps ? (
              <div className="text-[10px] text-amber-600 font-semibold flex items-center gap-1">
                <Crown className="h-3 w-3" /> Topo da trilha conquistado
              </div>
            ) : null}

            <div className="mt-2 grid grid-cols-4 gap-2 text-center pt-2 border-t">
              <Stat label="Faturamento" value={money(p.faturamento)} accent />
              <Stat label="Vendas" value={String(p.vendas)} />
              <Stat label="Reuniões" value={String(p.reunioes)} />
              <Stat label="Leads" value={String(p.leads)} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className={`text-xs font-bold ${accent ? "text-emerald-600" : ""}`}>{value}</div>
      <div className="text-[9px] uppercase text-muted-foreground">{label}</div>
    </div>
  );
}
