import { useEffect, useMemo, useState } from "react";
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors, useDraggable, useDroppable } from "@dnd-kit/core";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Trophy, Crown, Medal, Award, Sparkles, Target, GripVertical, Bell } from "lucide-react";
import { toast } from "sonner";

const money = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n || 0);

// Estágios da "carreira de performance" — linguagem corporativa, não-game
const STAGES = [
  { key: "iniciante",  label: "Iniciante",     min: 0,      color: "from-slate-400 to-slate-600",     icon: Target,    accent: "border-slate-400/40" },
  { key: "bronze",     label: "Bronze",        min: 5000,   color: "from-orange-500 to-orange-700",   icon: Award,     accent: "border-orange-500/40" },
  { key: "prata",      label: "Prata",         min: 20000,  color: "from-slate-300 to-slate-500",     icon: Medal,     accent: "border-slate-300/40" },
  { key: "ouro",       label: "Ouro",          min: 50000,  color: "from-amber-400 to-yellow-600",    icon: Trophy,    accent: "border-amber-400/50" },
  { key: "diamante",   label: "Diamante",      min: 100000, color: "from-cyan-400 to-blue-600",       icon: Crown,     accent: "border-cyan-400/50" },
];

export interface RankPlayer {
  user_id: string;
  name: string;
  role: string; // sdr | closer | hibrido
  faturamento: number;
  vendas: number;
  reunioes: number;
  leads: number;
  meta: number; // meta individual
}

function stageFor(faturamento: number) {
  let s = STAGES[0];
  for (const st of STAGES) if (faturamento >= st.min) s = st;
  return s;
}

function PlayerCard({ p, onNotify }: { p: RankPlayer; onNotify?: (p: RankPlayer) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: p.user_id });
  const initials = p.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  const pct = p.meta > 0 ? Math.min(100, (p.faturamento / p.meta) * 100) : 0;
  const bateuMeta = p.meta > 0 && p.faturamento >= p.meta;
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`p-2.5 rounded-lg border bg-card hover:bg-accent/30 transition cursor-grab active:cursor-grabbing ${
        isDragging ? "opacity-50" : ""
      } ${bateuMeta ? "border-emerald-500/60 ring-1 ring-emerald-500/30" : ""}`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <Avatar className="h-7 w-7">
          <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold truncate">{p.name}</div>
          <div className="text-[10px] text-muted-foreground uppercase">{p.role}</div>
        </div>
        {bateuMeta && (
          <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[9px]">
            <Sparkles className="h-2.5 w-2.5 mr-0.5" /> meta
          </Badge>
        )}
      </div>
      <div className="text-[11px] font-bold text-emerald-600">{money(p.faturamento)}</div>
      {p.meta > 0 && (
        <>
          <Progress value={pct} className="h-1 mt-1" />
          <div className="text-[9px] text-muted-foreground mt-0.5">
            {pct.toFixed(0)}% da meta {money(p.meta)}
          </div>
        </>
      )}
      <div className="flex gap-2 mt-1 text-[9px] text-muted-foreground">
        <span>{p.vendas}v</span>
        <span>·</span>
        <span>{p.reunioes}r</span>
        <span>·</span>
        <span>{p.leads}l</span>
      </div>
    </div>
  );
}

function StageColumn({
  stage,
  players,
}: {
  stage: typeof STAGES[number];
  players: RankPlayer[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.key });
  const Icon = stage.icon;
  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-lg border-2 ${stage.accent} bg-muted/20 min-h-[280px] transition ${
        isOver ? "bg-primary/10 border-primary" : ""
      }`}
    >
      <div className={`p-2.5 rounded-t-md bg-gradient-to-br ${stage.color} text-white`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Icon className="h-4 w-4" />
            <span className="text-xs font-bold uppercase">{stage.label}</span>
          </div>
          <Badge variant="secondary" className="text-[10px] bg-white/20 text-white border-0">
            {players.length}
          </Badge>
        </div>
        <div className="text-[10px] opacity-80 mt-0.5">≥ {money(stage.min)}</div>
      </div>
      <div className="p-2 space-y-1.5 flex-1">
        {players.length === 0 && (
          <div className="text-[10px] text-muted-foreground text-center py-4">Vazio</div>
        )}
        {players.map((p) => (
          <PlayerCard key={p.user_id} p={p} />
        ))}
      </div>
    </div>
  );
}

interface Props {
  players: RankPlayer[];
}

export function PerformanceRankBoard({ players }: Props) {
  const [autoMode, setAutoMode] = useState(true);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [notified, setNotified] = useState<Set<string>>(new Set());

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  // Notifica quando alguém bate a meta (uma vez por sessão)
  useEffect(() => {
    players.forEach((p) => {
      if (p.meta > 0 && p.faturamento >= p.meta && !notified.has(p.user_id)) {
        toast.success(`🎯 ${p.name} bateu a meta!`, {
          description: `${money(p.faturamento)} de ${money(p.meta)} • ${p.role.toUpperCase()}`,
          duration: 6000,
        });
        setNotified((prev) => new Set(prev).add(p.user_id));
      }
    });
  }, [players, notified]);

  const stagedPlayers = useMemo(() => {
    const map: Record<string, RankPlayer[]> = {};
    STAGES.forEach((s) => (map[s.key] = []));
    players.forEach((p) => {
      const key = autoMode ? stageFor(p.faturamento).key : (overrides[p.user_id] || stageFor(p.faturamento).key);
      map[key]?.push(p);
    });
    Object.values(map).forEach((arr) => arr.sort((a, b) => b.faturamento - a.faturamento));
    return map;
  }, [players, overrides, autoMode]);

  const handleDragEnd = (e: DragEndEvent) => {
    if (autoMode) {
      toast.info("Modo automático ativo — desative para mover manualmente.");
      return;
    }
    const playerId = String(e.active.id);
    const stageId = e.over?.id ? String(e.over.id) : null;
    if (!stageId) return;
    setOverrides((prev) => ({ ...prev, [playerId]: stageId }));
    const stage = STAGES.find((s) => s.key === stageId);
    const player = players.find((p) => p.user_id === playerId);
    if (stage && player) {
      toast.success(`${player.name} promovido(a) para ${stage.label}`);
    }
  };

  const totalBateuMeta = players.filter((p) => p.meta > 0 && p.faturamento >= p.meta).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Trophy className="h-4 w-4 text-amber-500" /> Plano de Carreira Comercial
            </CardTitle>
            <CardDescription className="text-xs">
              Avanço de cada SDR e Closer pelos níveis de performance — visualize o funil de evolução do time.
            </CardDescription>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs">
              <Bell className="h-3.5 w-3.5 text-emerald-500" />
              <span className="font-semibold text-emerald-600">{totalBateuMeta}</span>
              <span className="text-muted-foreground">bateram meta</span>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="auto-mode" checked={autoMode} onCheckedChange={setAutoMode} />
              <Label htmlFor="auto-mode" className="text-xs cursor-pointer">
                {autoMode ? "Automático" : "Manual"}
              </Label>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {STAGES.map((s) => (
              <StageColumn key={s.key} stage={s} players={stagedPlayers[s.key] || []} />
            ))}
          </div>
        </DndContext>
        <div className="mt-3 text-[10px] text-muted-foreground flex items-center gap-1.5">
          <Sparkles className="h-3 w-3" />
          {autoMode
            ? "Promoção automática conforme o faturamento de cada vendedor."
            : "Modo manual ativo — arraste os cards entre as colunas para promover."}
        </div>
      </CardContent>
    </Card>
  );
}
