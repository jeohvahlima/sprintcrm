import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Gamepad2, Phone, Bot, Repeat, ListOrdered, BarChart3,
  Zap, Flame, Coins, Trophy, Download, UserPlus, Flag,
  Mic, MicOff, PhoneOff, StickyNote, Target as TargetIcon,
  Crosshair, FileText,
} from "lucide-react";
import { ColdCallRedesigned } from "@/components/prospeccao/ColdCallRedesigned";

type TabKey = "hunter" | "coldcall" | "ia" | "cadencia" | "fila" | "performance";

const tabs: { key: TabKey; label: string; icon: any }[] = [
  { key: "hunter", label: "Hunter Cockpit", icon: Gamepad2 },
  { key: "coldcall", label: "Cold Call", icon: Phone },
  { key: "ia", label: "IA — Análise ICP", icon: Bot },
  { key: "cadencia", label: "Cadência", icon: Repeat },
  { key: "fila", label: "Minha Fila", icon: ListOrdered },
  { key: "performance", label: "Performance", icon: BarChart3 },
];

export default function MetasVendas() {
  const [tab, setTab] = useState<TabKey>("hunter");

  return (
    <div className="min-h-screen bg-background">
      {/* Topbar */}
      <div className="flex items-center justify-between gap-4 px-6 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white">
            <Crosshair className="h-5 w-5" />
          </div>
          <span className="font-semibold text-lg">Máquina de Vendas</span>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> LIVE
          </span>
          <Stat icon={<Zap className="h-3.5 w-3.5 text-amber-500" />} value="1.155" label="XP" />
          <Stat icon={<Flame className="h-3.5 w-3.5 text-orange-500" />} value="3d" label="Sequência" />
          <Stat icon={<Coins className="h-3.5 w-3.5 text-yellow-500" />} value="40" label="Moedas" />
          <Stat icon={<Trophy className="h-3.5 w-3.5 text-amber-500" />} value="#2" label="hoje" />
        </div>
        <div className="flex items-center gap-2">
          <select className="text-xs px-3 py-1.5 rounded-md border border-border bg-card">
            <option>30 dias</option><option>7 dias</option><option>90 dias</option>
          </select>
          <Button size="sm" variant="outline" className="h-8">
            <Download className="h-3.5 w-3.5 mr-1.5" /> Exportar
          </Button>
          <Button size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white">
            <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Adicionar Lead
          </Button>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* Hero — Meta do dia */}
        <div className="rounded-2xl p-5 bg-gradient-to-r from-blue-700 via-indigo-700 to-indigo-800 text-white shadow-lg">
          <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_auto] gap-6 items-center">
            <div>
              <div className="text-[11px] font-bold tracking-wider opacity-80 mb-1">META DO DIA</div>
              <div className="text-3xl font-bold mb-3">200 prospecções</div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 rounded-full bg-white/20 overflow-hidden">
                  <div className="h-full bg-emerald-400 rounded-full" style={{ width: "18%" }} />
                </div>
                <span className="text-xs opacity-90">18% concluído · 36/200</span>
                <span className="text-xs opacity-70">Faltam 164</span>
              </div>
            </div>
            <div>
              <div className="text-[11px] font-bold tracking-wider opacity-80 mb-1">REUNIÕES</div>
              <div className="text-3xl font-bold">4 <span className="text-lg opacity-70">/ 40</span></div>
            </div>
            <div>
              <div className="text-[11px] font-bold tracking-wider opacity-80 mb-1">PERDA ESTIMADA HOJE</div>
              <div className="text-3xl font-bold text-rose-300">R$ 8.320</div>
            </div>
            <Button className="bg-rose-500 hover:bg-rose-600 text-white border-0 h-11 px-4 font-semibold">
              <Flag className="h-4 w-4 mr-1.5" /> Recuperar agora
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Kpi tone="blue" icon="📞" label="LIGAÇÕES HOJE" value="36" sub="meta 200" delta="+12%" deltaUp />
          <Kpi tone="cyan" icon="📇" label="CONTATOS" value="18%" sub="taxa de conexão" delta="2%" deltaDown />
          <Kpi tone="amber" icon="📅" label="REUNIÕES AG." value="4" sub="de 40 no mês" delta="+8%" deltaUp />
          <Kpi tone="green" icon="✅" label="WIN RATE" value="73%" sub="+193% vs mês ant." />
          <Kpi tone="red" icon="⚠️" label="SEM FOLLOW-UP" value="12" sub="leads esfriando" />
          <Kpi tone="emerald" icon="💰" label="RECEITA MÊS" value="R$ 12.600" sub="ticket R$ 1.145" delta="+94%" deltaUp />
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-border overflow-x-auto">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition whitespace-nowrap ${
                  active
                    ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        {tab === "hunter" && <HunterCockpitView />}
        {tab === "coldcall" && <ColdCallRedesigned />}
        {tab === "ia" && <Placeholder title="IA — Análise ICP" description="Análise de empresas e score de propensão em tempo real." />}
        {tab === "cadencia" && <Placeholder title="Cadência" description="Sequência multicanal de toques (call, email, WhatsApp, social)." />}
        {tab === "fila" && <Placeholder title="Minha Fila" description="Próximas empresas a prospectar, priorizadas por score." />}
        {tab === "performance" && <Placeholder title="Performance" description="Indicadores e ranking semanal do time." />}
      </div>
    </div>
  );
}

/* ───────── Hunter Cockpit ───────── */
function HunterCockpitView() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
      <div className="space-y-5">
        {/* Header card */}
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <Gamepad2 className="h-5 w-5 text-emerald-600" />
            Grow Sales Hunter
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
              OUTBOUND FOCUS
            </span>
          </h2>
          <p className="text-sm text-muted-foreground">Seu painel de missões e ranking em tempo real</p>
        </div>

        {/* Next in queue */}
        <Card className="p-5 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white border-0">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-wider opacity-70 mb-3">
            <span>Próximo na fila — Cold Call</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold normal-case tracking-normal">
              🎯 Score IA: 87/100
            </span>
          </div>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center text-2xl">🏥</div>
            <div className="flex-1">
              <div className="text-lg font-bold">Clínica Saúde Total</div>
              <div className="text-sm opacity-80">CEO: Dr. Marcos Lima · São Paulo · 45 func.</div>
              <div className="flex gap-1.5 mt-1.5">
                <Tag tone="green">✓ ICP Perfeito</Tag>
                <Tag tone="amber">🔥 Alta intenção</Tag>
                <Tag tone="blue">3ª tentativa</Tag>
              </div>
            </div>
            <div className="text-right">
              <div className="text-4xl font-mono font-bold tabular-nums">00 : 00</div>
              <div className="text-xs opacity-70 mt-1">Aguardando ligação</div>
            </div>
          </div>
          {/* Call controls */}
          <div className="flex items-center justify-center gap-3 my-4">
            <button className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition">
              <MicOff className="h-5 w-5" />
            </button>
            <button className="w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center shadow-xl transition">
              <Phone className="h-6 w-6" />
            </button>
            <button className="w-12 h-12 rounded-full bg-rose-500 hover:bg-rose-600 flex items-center justify-center transition">
              <PhoneOff className="h-5 w-5" />
            </button>
            <button className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition">
              <StickyNote className="h-5 w-5" />
            </button>
          </div>
          {/* Outcome */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Outcome>✅ Conectou</Outcome>
            <Outcome>📬 C. Postal</Outcome>
            <Outcome>🙁 Não atend.</Outcome>
            <Outcome>❌ Desqual.</Outcome>
          </div>
        </Card>

        {/* Script */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 font-semibold">
              <FileText className="h-4 w-4 text-emerald-600" />
              Script de Abertura — Cold Call
            </div>
            <div className="flex gap-1 bg-muted rounded-lg p-1">
              <button className="px-3 py-1 text-xs rounded-md bg-emerald-600 text-white font-medium">Abertura</button>
              <button className="px-3 py-1 text-xs rounded-md text-muted-foreground hover:text-foreground">Objeções</button>
              <button className="px-3 py-1 text-xs rounded-md text-muted-foreground hover:text-foreground">Fechamento</button>
            </div>
          </div>
          <div className="rounded-lg bg-muted/50 p-4 mb-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Abertura padrão</div>
            <p className="text-sm leading-relaxed">
              "Oi, aqui é o <Slot>[seu nome]</Slot> da GrowOS. Eu vi que a <Slot>[Empresa]</Slot> atua no segmento de{" "}
              <Slot>[segmento]</Slot> e empresas similares estão usando nossa plataforma para{" "}
              <Slot tone="emerald">aumentar a conversão de leads em 3×</Slot>. Você tem 2 minutos para eu te mostrar como?"
            </p>
          </div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Objeções comuns</div>
          <div className="space-y-2">
            <Objection q='😐 "Não tenho tempo agora"' a='"Entendo! Que tal 10 min na sexta às 10h? Prometo ser objetivo."' />
            <Objection q='💸 "Está caro"' a='"Faz sentido. Mas se te mostrar que o ROI é de 4×, mudaria de opinião?"' />
            <Objection q='🔄 "Já uso outra ferramenta"' a='"Ótimo! Me conta como está funcionando? Clientes que vieram de lá economizaram 40%."' />
          </div>
        </Card>
      </div>

      {/* Sidebar */}
      <div className="space-y-4">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-bold flex items-center gap-1.5">⚡ Missões de hoje</div>
            <span className="text-[10px] font-bold text-amber-600">🔥 +200 XP disponíveis</span>
          </div>
          <div className="space-y-2.5">
            <Mission icon="📞" title="Caçar 10 leads" sub="0/10 hoje" xp={50} />
            <Mission icon="💬" title="Receber 3 respostas" sub="0/3" xp={60} />
            <Mission icon="📅" title="Agendar 1 reunião" sub="0/1" xp={100} />
            <Mission icon="🎯" title="Detectar oportunidade" sub="0/1" xp={70} />
            <Mission icon="🏆" title="Fechar negócio" sub="0/1" xp={200} />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-bold flex items-center gap-1.5">🏆 Ranking semanal</div>
            <span className="text-[10px] text-muted-foreground">Top 5</span>
          </div>
          <div className="space-y-1.5">
            <Rank pos="🥇" name="Jeohvah Lima" xp={2840} pct={100} />
            <Rank pos="#2" name="Você" xp={1155} pct={41} highlight />
            <Rank pos="#3" name="Ana Nunes" xp={980} pct={34} />
            <Rank pos="#4" name="Carlos M." xp={740} pct={26} />
            <Rank pos="#5" name="Beatriz S." xp={520} pct={18} />
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ───────── sub-components ───────── */

function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted text-xs">
      {icon}<span className="font-bold">{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

const kpiTones = {
  blue: "from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-950/10 border-blue-200/60 dark:border-blue-900/40",
  cyan: "from-cyan-50 to-cyan-100/50 dark:from-cyan-950/30 dark:to-cyan-950/10 border-cyan-200/60 dark:border-cyan-900/40",
  amber: "from-amber-50 to-amber-100/50 dark:from-amber-950/30 dark:to-amber-950/10 border-amber-200/60 dark:border-amber-900/40",
  green: "from-emerald-50 to-emerald-100/50 dark:from-emerald-950/30 dark:to-emerald-950/10 border-emerald-200/60 dark:border-emerald-900/40",
  red: "from-rose-50 to-rose-100/50 dark:from-rose-950/30 dark:to-rose-950/10 border-rose-200/60 dark:border-rose-900/40",
  emerald: "from-emerald-100 to-emerald-50 dark:from-emerald-950/40 dark:to-emerald-950/10 border-emerald-300/60 dark:border-emerald-900/40",
};

function Kpi({ tone, icon, label, value, sub, delta, deltaUp, deltaDown }: {
  tone: keyof typeof kpiTones; icon: string; label: string; value: string; sub?: string; delta?: string; deltaUp?: boolean; deltaDown?: boolean;
}) {
  return (
    <div className={`rounded-xl border bg-gradient-to-br p-3.5 ${kpiTones[tone]}`}>
      <div className="text-[10px] font-bold tracking-wider text-muted-foreground mb-1">{icon} {label}</div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1">
        <span>{sub}</span>
        {delta && (
          <span className={deltaUp ? "text-emerald-600 font-semibold" : deltaDown ? "text-rose-600 font-semibold" : ""}>
            {deltaUp ? "↑" : deltaDown ? "↓" : ""}{delta}
          </span>
        )}
      </div>
    </div>
  );
}

function Tag({ tone, children }: { tone: "green" | "amber" | "blue"; children: React.ReactNode }) {
  const tones = {
    green: "bg-emerald-500/20 text-emerald-200",
    amber: "bg-amber-500/20 text-amber-200",
    blue: "bg-blue-500/20 text-blue-200",
  };
  return <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${tones[tone]}`}>{children}</span>;
}

function Outcome({ children }: { children: React.ReactNode }) {
  return (
    <button className="text-xs font-medium py-2.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition">
      {children}
    </button>
  );
}

function Slot({ children, tone }: { children: React.ReactNode; tone?: "emerald" }) {
  const cls = tone === "emerald"
    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
    : "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300";
  return <span className={`px-1.5 py-0.5 rounded text-[12px] font-medium ${cls}`}>{children}</span>;
}

function Objection({ q, a }: { q: string; a: string }) {
  return (
    <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-4 py-1.5 border-b border-border last:border-0">
      <div className="text-xs font-medium md:w-1/3">{q}</div>
      <div className="text-xs text-muted-foreground flex-1">→ {a}</div>
    </div>
  );
}

function Mission({ icon, title, sub, xp }: { icon: string; title: string; sub: string; xp: number }) {
  return (
    <div className="flex items-center gap-2.5 p-2 rounded-lg bg-muted/50">
      <div className="w-8 h-8 rounded-md bg-card border border-border flex items-center justify-center text-sm">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold truncate">{title}</div>
        <div className="text-[10px] text-muted-foreground">{sub}</div>
      </div>
      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">
        +{xp} XP
      </span>
    </div>
  );
}

function Rank({ pos, name, xp, pct, highlight }: { pos: string; name: string; xp: number; pct: number; highlight?: boolean }) {
  return (
    <div className={`flex items-center gap-2 p-1.5 rounded-md ${highlight ? "bg-emerald-50 dark:bg-emerald-950/30" : ""}`}>
      <span className="text-xs font-bold w-6">{pos}</span>
      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center text-[10px] text-white font-bold">
        {name[0]}
      </div>
      <span className="text-xs font-medium flex-1 truncate">{name}</span>
      <span className="text-xs font-bold tabular-nums">{xp.toLocaleString("pt-BR")}</span>
      <div className="w-12 h-1 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Placeholder({ title, description }: { title: string; description: string }) {
  return (
    <Card className="p-10 text-center">
      <h3 className="text-lg font-bold mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </Card>
  );
}
