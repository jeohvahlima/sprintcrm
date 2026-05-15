import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Flame, Trophy, Zap, Target, TrendingUp, TrendingDown, Crown, Medal, Award,
  Sparkles, Phone, MessageSquare, CalendarCheck, ChevronRight, Coins, Bell,
  Rocket, Activity, Gauge, Radar as RadarIcon, Swords,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
} from "recharts";
import { ClassAvatar } from "./rpg/ClassAvatar";
import { usePlayerProfile, xpNeededForLevel, getRankByLevel } from "@/hooks/usePlayerProfile";
import { useDailyFocus } from "@/hooks/useDailyFocus";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import { useAchievements, ALL_ACHIEVEMENTS } from "@/hooks/useAchievements";

const money = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n || 0);

const LEVEL_TIERS = [
  { min: 1,  name: "Rookie SDR",       icon: "🌱", grad: "from-slate-400 to-slate-600",      glow: "rgba(148,163,184,0.5)" },
  { min: 5,  name: "Hunter SDR",       icon: "⚡", grad: "from-cyan-400 to-blue-600",         glow: "rgba(34,211,238,0.5)" },
  { min: 15, name: "Elite Hunter",     icon: "🔥", grad: "from-orange-400 to-red-600",        glow: "rgba(251,146,60,0.5)" },
  { min: 30, name: "Growth Hunter",    icon: "🚀", grad: "from-purple-400 to-fuchsia-600",    glow: "rgba(192,132,252,0.5)" },
  { min: 50, name: "Revenue Operator", icon: "👑", grad: "from-amber-300 to-yellow-600",      glow: "rgba(252,211,77,0.6)" },
  { min: 75, name: "Master Closer",    icon: "💎", grad: "from-emerald-300 to-teal-600",      glow: "rgba(110,231,183,0.6)" },
];

function tierFor(level: number) {
  let t = LEVEL_TIERS[0];
  for (const x of LEVEL_TIERS) if (level >= x.min) t = x;
  return t;
}

const MISSION_ICON: Record<string, any> = {
  calls: Phone,
  responses: MessageSquare,
  meetings_scheduled: CalendarCheck,
  leads_prospected: Target,
  prospections_fallback: Target,
  opportunities: Sparkles,
  sales_closed: Trophy,
  gross_value: Coins,
};

const MISSION_XP: Record<string, number> = {
  calls: 5, responses: 10, meetings_scheduled: 40,
  leads_prospected: 5, prospections_fallback: 5,
  opportunities: 15, sales_closed: 150, gross_value: 0,
};

// Animated counter
function useCountUp(target: number, duration = 1200) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let raf: number;
    const start = performance.now();
    const from = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(from + (target - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

// Circular progress ring
function Ring({ value, size = 64, stroke = 6, color = "hsl(var(--primary))", track = "hsl(var(--muted))", children }: any) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (Math.min(100, value) / 100) * c;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" opacity={0.25} />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={color} strokeWidth={stroke} fill="none"
          strokeDasharray={c} strokeDashoffset={off}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.16,1,0.3,1)", filter: `drop-shadow(0 0 6px ${color})` }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

// Half-gauge KPI
function Gauge180({ value, label, color = "hsl(var(--primary))" }: { value: number; label: string; color?: string }) {
  const pct = Math.min(100, Math.max(0, value));
  const angle = -90 + (pct / 100) * 180;
  return (
    <div className="relative">
      <svg viewBox="0 0 120 70" className="w-full h-auto">
        <path d="M 10 60 A 50 50 0 0 1 110 60" stroke="hsl(var(--muted))" strokeWidth="10" fill="none" opacity="0.3" strokeLinecap="round" />
        <path
          d="M 10 60 A 50 50 0 0 1 110 60"
          stroke={color}
          strokeWidth="10"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * 157} 157`}
          style={{ filter: `drop-shadow(0 0 4px ${color})`, transition: "stroke-dasharray 1s ease-out" }}
        />
        <line
          x1="60" y1="60" x2="60" y2="22"
          stroke={color} strokeWidth="2" strokeLinecap="round"
          style={{ transformOrigin: "60px 60px", transform: `rotate(${angle}deg)`, transition: "transform 1s cubic-bezier(0.16,1,0.3,1)" }}
        />
        <circle cx="60" cy="60" r="3" fill={color} />
      </svg>
      <div className="text-center -mt-2">
        <div className="text-xl font-black tabular-nums" style={{ color }}>{pct}%</div>
        <div className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">{label}</div>
      </div>
    </div>
  );
}

export function HunterCockpit() {
  const { data: profile, companyId, userId } = usePlayerProfile();
  const focus = useDailyFocus();
  const { data: leaderboard = [] } = useLeaderboard(companyId, 10);
  const { data: achievements = [] } = useAchievements(userId);

  const tier = profile ? tierFor(profile.level) : LEVEL_TIERS[0];
  const rank = profile ? getRankByLevel(profile.level) : null;
  const needed = profile ? xpNeededForLevel(profile.level) : 100;
  const lvlPct = profile ? Math.min(100, Math.round((profile.xp_current / needed) * 100)) : 0;
  const myEntry = leaderboard.find((l) => l.user_id === userId);
  const myIdx = leaderboard.findIndex((l) => l.user_id === userId);

  const xpDisplay = useCountUp(profile?.xp_total ?? 0);
  const coinsDisplay = useCountUp(profile?.coins ?? 0);

  const dynamicMessage = useMemo(() => {
    if (!focus.metrics.length) return "Configure suas metas para começar a operação.";
    const top = focus.metrics.find((m) => m.progress_pct < 100);
    if (!top) return "🎯 Você bateu todas as metas do dia. Continue caçando.";
    const gap = top.target - top.current;
    return `Faltam ${gap} ${top.label.toLowerCase()} para bater sua meta.`;
  }, [focus]);

  const alerts = useMemo(() => {
    const a: { tone: "up" | "down" | "info"; text: string }[] = [];
    if (focus.posicao === 1) a.push({ tone: "up", text: "🥇 Você é o #1 da equipe hoje" });
    else if (focus.posicao && focus.proximo_acima)
      a.push({ tone: "info", text: `⚡ ${focus.xp_para_subir} pts para passar ${focus.proximo_acima.full_name}` });
    if (focus.overall_progress_pct >= 80) a.push({ tone: "up", text: `🚀 Ritmo elite — ${focus.overall_progress_pct}% da meta` });
    else if (focus.overall_progress_pct < 30 && focus.metrics.length > 0)
      a.push({ tone: "down", text: `⚠️ Ritmo abaixo do esperado (${focus.overall_progress_pct}%)` });
    if (profile?.streak_days && profile.streak_days >= 3)
      a.push({ tone: "up", text: `🔥 ${profile.streak_days} dias seguidos em operação` });
    if (focus.perda_estimada_hoje > 0)
      a.push({ tone: "down", text: `💸 Perda estimada hoje: ${money(focus.perda_estimada_hoje)}` });
    return a.slice(0, 5);
  }, [focus, profile]);

  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const recent = achievements.filter((a) => a.unlocked).slice(0, 8);
  const next = achievements.filter((a) => !a.unlocked).slice(0, 3);

  // Radar de performance (normalizado 0-100)
  const radarData = useMemo(() => {
    if (focus.metrics.length === 0) return [];
    return focus.metrics.slice(0, 6).map((m) => ({
      kpi: m.label.slice(0, 10),
      value: m.progress_pct,
      full: 100,
    }));
  }, [focus]);

  // KPIs do Performance dashboard
  const conversaoPct = useMemo(() => {
    const reun = focus.metrics.find(m => m.metric === "meetings_scheduled");
    const prosp = focus.metrics.find(m => m.metric === "leads_prospected" || m.metric === "prospections_fallback");
    if (!reun || !prosp || prosp.current === 0) return 0;
    return Math.round((reun.current / prosp.current) * 100);
  }, [focus]);

  return (
    <div className="space-y-4">
      {/* ═══════════ HERO COCKPIT — fundo grid neon ═══════════ */}
      <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-[hsl(160_35%_5%)] dark:bg-[hsl(160_35%_5%)] shadow-[0_20px_60px_-20px_hsl(var(--primary)/0.4)]">
        {/* Layers de fundo */}
        <div className="absolute inset-0 cockpit-grid-bg opacity-60" />
        <div className={`absolute -top-32 -right-32 w-96 h-96 rounded-full bg-gradient-to-br ${tier.grad} opacity-20 blur-3xl pulse-ring`} />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-primary/20 blur-3xl pulse-ring" style={{ animationDelay: "1.2s" }} />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />

        <div className="relative p-6 md:p-8 text-white">
          {/* Topo: Tier badge */}
          <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
            <div className="flex items-center gap-2">
              <div className="relative">
                <div className={`absolute inset-0 bg-gradient-to-r ${tier.grad} blur-md opacity-70`} />
                <div className={`relative px-3 py-1.5 rounded-md bg-gradient-to-r ${tier.grad} text-[11px] font-black uppercase tracking-[0.2em] shadow-xl`}>
                  {tier.icon} {tier.name}
                </div>
              </div>
              <div className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-[11px] font-bold backdrop-blur">
                <span className="text-primary neon-text">LV.</span> <span className="font-mono">{profile?.level ?? 1}</span>
              </div>
              {rank && (
                <div className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-[10px] font-medium">
                  {rank.name}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {profile && profile.streak_days > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-orange-500/15 border border-orange-500/40 backdrop-blur">
                  <Flame className="w-4 h-4 text-orange-400 float-y" />
                  <span className="text-orange-300 text-sm font-black tabular-nums">{profile.streak_days}</span>
                  <span className="text-orange-300/70 text-[10px] uppercase tracking-wider font-bold">dias</span>
                </div>
              )}
              <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 backdrop-blur">
                <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span className="text-emerald-300 text-[10px] uppercase tracking-widest font-bold">LIVE</span>
              </div>
            </div>
          </div>

          {/* Grid principal: avatar + dados + métricas circulares */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Avatar grande com glow */}
            <div className="lg:col-span-3 flex flex-col items-center">
              <div className="relative">
                <div
                  className={`absolute -inset-4 rounded-full bg-gradient-to-br ${tier.grad} blur-2xl opacity-60 pulse-ring`}
                />
                <div className={`absolute -inset-1 rounded-full bg-gradient-to-br ${tier.grad}`} />
                <div className="relative">
                  <ClassAvatar
                    name={profile?.title || "Hunter"}
                    playerClass={profile?.class}
                    size="xl"
                    level={profile?.level}
                    online
                  />
                </div>
                <div
                  className={`absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-gradient-to-r ${tier.grad} text-[10px] font-black tracking-wider shadow-lg whitespace-nowrap`}
                >
                  NV. {profile?.level ?? 1}
                </div>
              </div>
              <h2 className="mt-5 text-xl md:text-2xl font-black tracking-tight text-center">
                {profile?.title || "Hunter Iniciante"}
              </h2>
              <p className="text-xs text-white/60 text-center mt-1 max-w-[200px]">{dynamicMessage}</p>
            </div>

            {/* Coluna central: barras + stats */}
            <div className="lg:col-span-6 space-y-4">
              {/* XP bar gigante */}
              <div>
                <div className="flex justify-between text-[11px] mb-2">
                  <span className="text-white/60 font-bold uppercase tracking-widest">⚡ Experiência</span>
                  <span className="font-mono font-black text-cyan-300">
                    {(profile?.xp_current ?? 0).toLocaleString()} <span className="text-white/40">/</span> {needed.toLocaleString()} XP
                  </span>
                </div>
                <div className="relative h-4 bg-black/40 rounded-full overflow-hidden border border-white/10">
                  <div
                    className={`absolute inset-y-0 left-0 bg-gradient-to-r ${tier.grad} bar-fill`}
                    style={{
                      width: `${lvlPct}%`,
                      boxShadow: `0 0 20px ${tier.glow}, inset 0 0 8px rgba(255,255,255,0.4)`,
                    }}
                  />
                  <div className="absolute inset-0 cockpit-shimmer opacity-40" />
                  <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black tracking-wider drop-shadow-lg">
                    {lvlPct}%
                  </div>
                </div>
              </div>

              {/* Meta do dia */}
              {focus.metrics.length > 0 && (
                <div>
                  <div className="flex justify-between text-[11px] mb-2">
                    <span className="text-white/60 font-bold uppercase tracking-widest flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5 text-primary" /> Meta Operacional do Dia
                    </span>
                    <span className="font-mono font-black text-primary neon-text">{focus.overall_progress_pct}%</span>
                  </div>
                  <div className="relative h-3 bg-black/40 rounded-full overflow-hidden border border-white/10">
                    <div
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary via-primary to-emerald-400 bar-fill"
                      style={{
                        width: `${focus.overall_progress_pct}%`,
                        boxShadow: "0 0 20px hsl(var(--primary) / 0.7)",
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Stats row */}
              <div className="grid grid-cols-4 gap-2 pt-2">
                <StatCell icon={<Zap className="w-3 h-3" />} label="XP TOTAL" value={xpDisplay.toLocaleString()} color="text-cyan-300" />
                <StatCell icon={<Coins className="w-3 h-3" />} label="MOEDAS" value={coinsDisplay.toLocaleString()} color="text-amber-300" />
                <StatCell icon={<Trophy className="w-3 h-3" />} label="BADGES" value={`${unlockedCount}/${ALL_ACHIEVEMENTS.length}`} color="text-emerald-300" />
                <StatCell icon={<Crown className="w-3 h-3" />} label="POSIÇÃO" value={focus.posicao ? `#${focus.posicao}` : "—"} color={focus.posicao === 1 ? "text-amber-300" : "text-fuchsia-300"} />
              </div>
            </div>

            {/* Coluna direita: 3 anéis circulares */}
            <div className="lg:col-span-3 grid grid-cols-3 lg:grid-cols-1 gap-3">
              <RingStat
                value={lvlPct}
                label="LEVEL"
                color="hsl(190 95% 60%)"
                main={`${lvlPct}%`}
                sub={`Lv. ${profile?.level ?? 1}`}
              />
              <RingStat
                value={focus.overall_progress_pct}
                label="META"
                color="hsl(142 71% 50%)"
                main={`${focus.overall_progress_pct}%`}
                sub="hoje"
              />
              <RingStat
                value={Math.min(100, conversaoPct)}
                label="CONV."
                color="hsl(280 80% 65%)"
                main={`${conversaoPct}%`}
                sub="reun/lead"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════ ROW 2: Missões + Pódio + Radar ═══════════ */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* MISSÕES */}
        <div className="xl:col-span-5 rounded-2xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center neon-glow-primary">
                <Swords className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider">Missões do Dia</h3>
                <p className="text-[10px] text-muted-foreground">Cada ação acumula XP — mantenha o ritmo</p>
              </div>
            </div>
            <Badge variant="outline" className="text-[10px] font-mono">
              {focus.metrics.filter((m) => m.progress_pct >= 100).length}/{focus.metrics.length}
            </Badge>
          </div>

          <div className="p-4">
            {focus.metrics.length === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground">
                <Rocket className="w-10 h-10 mx-auto mb-3 opacity-30" />
                Configure metas comerciais para liberar suas missões.
                <div className="mt-3">
                  <Button asChild size="sm" variant="outline">
                    <Link to="/configuracoes/comercial">Configurar metas</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {focus.metrics.map((m) => {
                  const Icon = MISSION_ICON[m.metric] || Target;
                  const xp = MISSION_XP[m.metric] ?? 10;
                  const done = m.progress_pct >= 100;
                  const ringColor = done ? "hsl(142 71% 45%)" : "hsl(var(--primary))";
                  return (
                    <div
                      key={m.metric}
                      className={`relative flex items-center gap-3 p-3 rounded-xl border transition-all ${
                        done
                          ? "border-emerald-500/40 bg-gradient-to-r from-emerald-500/10 to-transparent"
                          : "border-border bg-background/60 hover:border-primary/40 hover:bg-primary/5"
                      }`}
                    >
                      <Ring value={m.progress_pct} size={56} stroke={5} color={ringColor}>
                        <Icon className={`w-5 h-5 ${done ? "text-emerald-500" : "text-primary"}`} />
                      </Ring>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold">{m.label}</span>
                          {done && (
                            <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/40 text-[9px] font-black px-1.5 py-0">
                              ✓ FEITO
                            </Badge>
                          )}
                          {xp > 0 && (
                            <span className="ml-auto text-[10px] font-mono font-black text-cyan-500">+{xp} XP</span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                          {m.current.toLocaleString()} / {m.target.toLocaleString()}
                          <span className="ml-2 text-foreground/40">
                            {done ? "→ concluída" : `→ faltam ${Math.max(0, m.target - m.current)}`}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* PÓDIO ARENA */}
        <div className="xl:col-span-4 rounded-2xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-gradient-to-r from-amber-500/10 to-transparent">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center" style={{ boxShadow: "0 0 20px rgba(251,191,36,0.25)" }}>
                <Trophy className="w-4 h-4 text-amber-500" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider">Arena Hunter</h3>
                <p className="text-[10px] text-muted-foreground">Ranking ao vivo</p>
              </div>
            </div>
            <span className="text-[10px] font-mono text-emerald-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> AO VIVO
            </span>
          </div>

          <div className="p-4">
            {leaderboard.length === 0 ? (
              <div className="text-center py-10 text-xs text-muted-foreground">Nenhum hunter no ranking.</div>
            ) : (
              <>
                {/* Pódio 3D */}
                <div className="grid grid-cols-3 gap-2 mb-4 items-end">
                  {[1, 0, 2].map((podiumIdx) => {
                    const r = leaderboard[podiumIdx];
                    if (!r) return <div key={podiumIdx} />;
                    const isMe = r.user_id === userId;
                    const realPos = podiumIdx + 1;
                    const heights = ["", "h-24", "h-16", "h-12"];
                    const grads = ["", "from-amber-300 via-yellow-500 to-amber-700", "from-slate-200 via-slate-300 to-slate-500", "from-orange-400 via-orange-600 to-orange-800"];
                    const glows = ["", "rgba(251,191,36,0.6)", "rgba(203,213,225,0.5)", "rgba(251,146,60,0.5)"];
                    const Icon = realPos === 1 ? Crown : realPos === 2 ? Medal : Award;
                    return (
                      <div key={r.user_id} className="flex flex-col items-center">
                        <div className="relative">
                          {realPos === 1 && (
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-2xl float-y">👑</div>
                          )}
                          <div className={`relative ${isMe ? "ring-2 ring-primary ring-offset-2 ring-offset-background rounded-full" : ""}`}>
                            <ClassAvatar name={r.full_name} size="sm" />
                          </div>
                        </div>
                        <div className="text-[10px] font-bold mt-2 text-center truncate max-w-[80px]">{r.full_name.split(" ")[0]}</div>
                        <div className="text-[9px] text-muted-foreground font-mono">{r.xp_total.toLocaleString()}</div>
                        <div
                          className={`w-full mt-2 rounded-t-lg ${heights[realPos]} bg-gradient-to-b ${grads[realPos]} flex flex-col items-center justify-start pt-1.5 relative overflow-hidden`}
                          style={{ boxShadow: `0 -8px 24px -4px ${glows[realPos]}` }}
                        >
                          <Icon className="w-4 h-4 text-white drop-shadow-md" />
                          <span className="text-white text-base font-black drop-shadow-md mt-0.5">#{realPos}</span>
                          <div className="absolute inset-x-0 top-0 h-px bg-white/40" />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Lista 4-8 */}
                <div className="space-y-1 border-t border-border pt-2">
                  {leaderboard.slice(3, 8).map((r, i) => {
                    const isMe = r.user_id === userId;
                    return (
                      <div key={r.user_id} className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition ${isMe ? "bg-primary/10 border border-primary/30" : "hover:bg-accent/30"}`}>
                        <span className="w-6 text-[10px] font-mono text-muted-foreground text-center">#{i + 4}</span>
                        <span className="flex-1 truncate font-medium">{r.full_name} {isMe && <span className="text-primary text-[9px]">(você)</span>}</span>
                        <span className="font-mono text-[10px] text-muted-foreground">{r.xp_total.toLocaleString()}</span>
                        {r.streak_days > 0 && (
                          <span className="text-orange-500 text-[10px] flex items-center gap-0.5">
                            <Flame className="w-2.5 h-2.5" />{r.streak_days}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {myIdx >= 8 && myEntry && (
                  <div className="mt-2 px-2 py-1.5 rounded-md bg-primary/10 border border-primary/30 text-xs flex items-center gap-2">
                    <span className="w-6 text-[10px] font-mono text-primary text-center">#{myIdx + 1}</span>
                    <span className="flex-1 truncate font-medium">{myEntry.full_name} <span className="text-primary text-[9px]">(você)</span></span>
                    <span className="font-mono text-[10px]">{myEntry.xp_total.toLocaleString()}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* RADAR DE PERFORMANCE + Gauges */}
        <div className="xl:col-span-3 rounded-2xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-gradient-to-r from-cyan-500/10 to-transparent">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center">
              <RadarIcon className="w-4 h-4 text-cyan-500" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider">Performance</h3>
              <p className="text-[10px] text-muted-foreground">Radar operacional</p>
            </div>
          </div>
          <div className="p-3">
            {radarData.length >= 3 ? (
              <ResponsiveContainer width="100%" height={180}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="kpi" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar
                    dataKey="value"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary))"
                    fillOpacity={0.4}
                    strokeWidth={2}
                  />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid grid-cols-2 gap-2 py-2">
                <Gauge180 value={focus.overall_progress_pct} label="META" color="hsl(142 71% 50%)" />
                <Gauge180 value={Math.min(100, conversaoPct)} label="CONV." color="hsl(280 80% 65%)" />
                <Gauge180 value={lvlPct} label="LEVEL" color="hsl(190 95% 60%)" />
                <Gauge180 value={Math.min(100, (unlockedCount / ALL_ACHIEVEMENTS.length) * 100)} label="BADGES" color="hsl(45 95% 55%)" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════ ROW 3: Conquistas + Alertas ═══════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Conquistas */}
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-gradient-to-r from-purple-500/10 to-transparent">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center" style={{ boxShadow: "0 0 20px rgba(168,85,247,0.25)" }}>
                <Award className="w-4 h-4 text-purple-500" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider">Conquistas</h3>
                <p className="text-[10px] text-muted-foreground">{unlockedCount} de {ALL_ACHIEVEMENTS.length} desbloqueadas</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Progress value={(unlockedCount / ALL_ACHIEVEMENTS.length) * 100} className="w-24 h-1.5" />
              <span className="text-[10px] font-mono font-black text-purple-500">
                {Math.round((unlockedCount / ALL_ACHIEVEMENTS.length) * 100)}%
              </span>
            </div>
          </div>

          <div className="p-4">
            {recent.length > 0 && (
              <>
                <div className="text-[9px] text-muted-foreground uppercase tracking-widest font-black mb-2">Desbloqueadas</div>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 mb-4">
                  {recent.map((a) => {
                    const rarityCls =
                      a.rarity === "legendary"
                        ? "border-amber-400 bg-gradient-to-br from-amber-400/30 to-yellow-600/10"
                        : a.rarity === "epic"
                        ? "border-purple-400 bg-gradient-to-br from-purple-400/30 to-fuchsia-600/10"
                        : a.rarity === "rare"
                        ? "border-cyan-400 bg-gradient-to-br from-cyan-400/30 to-blue-600/10"
                        : "border-border bg-muted/30";
                    const glow =
                      a.rarity === "legendary"
                        ? "shadow-[0_0_20px_rgba(251,191,36,0.5)]"
                        : a.rarity === "epic"
                        ? "shadow-[0_0_15px_rgba(192,132,252,0.4)]"
                        : a.rarity === "rare"
                        ? "shadow-[0_0_12px_rgba(34,211,238,0.4)]"
                        : "";
                    return (
                      <div
                        key={a.code}
                        title={`${a.name} — ${a.description}`}
                        className={`relative aspect-square rounded-xl border-2 flex flex-col items-center justify-center p-1.5 cursor-help transition hover:scale-110 hover:-rotate-3 ${rarityCls} ${glow}`}
                      >
                        <div className="text-2xl">{a.icon}</div>
                        <div className="text-[7px] font-black text-center mt-0.5 truncate w-full uppercase tracking-wider">{a.name.split(" ")[0]}</div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {next.length > 0 && (
              <>
                <div className="text-[9px] text-muted-foreground uppercase tracking-widest font-black mb-2">Próximas</div>
                <div className="space-y-1.5">
                  {next.map((a) => (
                    <div key={a.code} className="flex items-center gap-2 p-2 rounded-lg border border-dashed border-border bg-muted/20">
                      <div className="text-xl opacity-40 grayscale">{a.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-muted-foreground">{a.name}</div>
                        <div className="text-[10px] text-muted-foreground/70 truncate">{a.description}</div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40" />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Central de Alertas */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-gradient-to-r from-cyan-500/10 to-transparent">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center">
              <Bell className="w-4 h-4 text-cyan-500 float-y" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider">Alertas</h3>
              <p className="text-[10px] text-muted-foreground">Sinais em tempo real</p>
            </div>
          </div>

          <div className="p-4">
            {alerts.length === 0 ? (
              <div className="text-xs text-muted-foreground py-6 text-center">Tudo no eixo. Continue caçando.</div>
            ) : (
              <div className="space-y-2">
                {alerts.map((a, i) => {
                  const Icon = a.tone === "up" ? TrendingUp : a.tone === "down" ? TrendingDown : Zap;
                  const cls =
                    a.tone === "up"
                      ? "border-l-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : a.tone === "down"
                      ? "border-l-red-500 bg-red-500/10 text-red-600 dark:text-red-400"
                      : "border-l-cyan-500 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400";
                  return (
                    <div key={i} className={`flex items-start gap-2 p-2.5 rounded-r-lg border-l-4 ${cls}`}>
                      <Icon className="w-4 h-4 mt-0.5 shrink-0" />
                      <span className="text-xs font-semibold leading-snug">{a.text}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════ TRILHA DE NÍVEIS ═══════════ */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-gradient-to-r from-primary/10 to-transparent">
          <div className="w-9 h-9 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center neon-glow-primary">
            <Rocket className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider">Trilha de Carreira Hunter</h3>
            <p className="text-[10px] text-muted-foreground">Evolua de Rookie até Master Closer</p>
          </div>
        </div>
        <div className="p-4 relative">
          {/* Linha conectora */}
          <div className="absolute top-1/2 left-8 right-8 h-0.5 bg-gradient-to-r from-primary/0 via-primary/40 to-primary/0 hidden md:block" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 relative">
            {LEVEL_TIERS.map((t) => {
              const reached = (profile?.level ?? 1) >= t.min;
              const current = tier.min === t.min;
              return (
                <div
                  key={t.name}
                  className={`relative rounded-xl border-2 p-3 text-center transition-all ${
                    current
                      ? "border-primary scale-105 shadow-xl"
                      : reached
                      ? "border-emerald-500/40 bg-emerald-500/5"
                      : "border-border bg-muted/20 opacity-50"
                  }`}
                  style={current ? { boxShadow: `0 0 30px ${t.glow}` } : {}}
                >
                  {current && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                      <Badge className={`bg-gradient-to-r ${t.grad} text-white border-0 text-[9px] px-2 font-black tracking-wider shadow-lg`}>
                        ★ AQUI
                      </Badge>
                    </div>
                  )}
                  <div className={`text-3xl mb-1 ${!reached && "grayscale opacity-40"} ${current && "float-y"}`}>{t.icon}</div>
                  <div className="text-[10px] font-black uppercase tracking-wider">{t.name}</div>
                  <div className="text-[9px] text-muted-foreground mt-0.5 font-mono">Nível {t.min}+</div>
                  {reached && !current && (
                    <div className="absolute top-1 right-1 text-emerald-500">✓</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCell({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur px-2.5 py-2">
      <div className={`flex items-center gap-1 ${color}`}>
        {icon}
        <span className="text-[9px] uppercase tracking-widest font-black">{label}</span>
      </div>
      <div className="text-lg font-black mt-0.5 tabular-nums">{value}</div>
    </div>
  );
}

function RingStat({ value, label, color, main, sub }: { value: number; label: string; color: string; main: string; sub: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-white/10 bg-white/5 backdrop-blur p-3">
      <Ring value={value} size={70} stroke={6} color={color}>
        <div className="text-center">
          <div className="text-sm font-black tabular-nums" style={{ color }}>{main}</div>
          <div className="text-[8px] uppercase text-white/50">{sub}</div>
        </div>
      </Ring>
      <div className="text-[9px] uppercase tracking-widest font-black mt-1.5 text-white/70">{label}</div>
    </div>
  );
}
