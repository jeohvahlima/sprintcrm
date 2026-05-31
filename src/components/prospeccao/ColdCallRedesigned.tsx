import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Phone, PhoneCall, Download, Funnel, ListChecks, Bot, ListOrdered, FileText, PhoneIncoming, ArrowUpRight,
} from "lucide-react";

/**
 * Cold Call Outbound Redesign — Máquina de Vendas
 * Layout inspirado no mockup: KPIs, funil outbound, registro de ligações,
 * IA pré-SDR, fila de prospecção, script ativo.
 */
export function ColdCallRedesigned() {
  return (
    <div className="space-y-4">
      {/* Topbar interna */}
      <div className="flex items-center justify-between gap-4 p-3 px-4 rounded-xl border border-border bg-card">
        <div className="flex items-center gap-3">
          <PhoneCall className="h-5 w-5 text-blue-600" />
          <span className="text-base font-semibold">Cold Call — Outbound</span>
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border border-blue-200 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:border-blue-900 dark:text-blue-300">
            80% Outbound
          </span>
        </div>
        <div className="flex items-center gap-2">
          <select className="text-xs px-2 py-1 rounded-md border border-border bg-muted text-foreground">
            <option>Últimos 30 dias</option>
            <option>Últimos 7 dias</option>
            <option>Últimos 90 dias</option>
          </select>
          <Button size="sm" variant="outline" className="h-7 text-xs">
            <Download className="h-3.5 w-3.5 mr-1" /> Exportar
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <KPI label="Ligações hoje" value="47" sub="Meta: 60" tone="blue" />
        <KPI label="Conexões" value="18" suffix="38%" sub="Taxa de contato" tone="green" />
        <KPI label="Reuniões agendadas" value="5" sub="+2 vs ontem" tone="amber" />
        <KPI label="Pipeline gerado" value="R$ 84k" sub="Potencial estimado" tone="green" />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-3">
        {/* LEFT */}
        <div className="space-y-3">
          {/* Funil */}
          <Card className="p-4">
            <PanelTitle icon={<Funnel className="h-3.5 w-3.5" />}>
              Funil de prospecção — cold call
            </PanelTitle>
            <div className="space-y-1.5">
              <FunnelRow label="1. Lista prospectada" text="Empresas mapeadas pela IA" count={240} pct={100} color="blue" />
              <Arrow />
              <FunnelRow label="2. Primeiro contato" text="Ligação realizada" count={188} pct={78} color="teal" />
              <Arrow />
              <FunnelRow label="3. Conectou" text="Atendeu a ligação" count={96} pct={40} color="amber" />
              <Arrow />
              <FunnelRow label="4. Qualificado" text="ICP confirmado" count={52} pct={22} color="orange" />
              <Arrow />
              <FunnelRow label="5. Reunião agendada" text="Passado pro closer" count={26} pct={11} color="green" />
            </div>
            <div className="flex gap-1.5 flex-wrap mt-3">
              <Suggest>Como melhorar a taxa de conexão ↗</Suggest>
              <Suggest>Melhores horários para ligar ↗</Suggest>
            </div>
          </Card>

          {/* Registro de ligações */}
          <Card className="p-4">
            <PanelTitle icon={<ListChecks className="h-3.5 w-3.5" />}>
              Registro de ligações — hoje
            </PanelTitle>
            <div className="space-y-1.5">
              <CallItem dot="blue" name="Grupo Nexus Logística" detail="Carlos Mendes · Diretor Comercial · 4 min" time="10:42" tag={{ text: "Reunião agendada", tone: "blue" }} />
              <CallItem dot="amber" name="FastTech Soluções" detail="Tentativa 2 · Sem atendimento" time="10:18" tag={{ text: "Retentar amanhã", tone: "amber" }} />
              <CallItem dot="green" name="Construtora Alfa RJ" detail="Ana Lima · Gerente de Compras · 2 min" time="09:55" tag={{ text: "Qualificada", tone: "green" }} />
              <CallItem dot="gray" name="Micro Distribuidora Sul" detail="Fora do ICP · Porte muito pequeno" time="09:31" tag={{ text: "Descartada", tone: "gray" }} />
            </div>
            <div className="flex gap-2 mt-3">
              <Button size="sm" className="h-7 text-xs">
                <PhoneIncoming className="h-3.5 w-3.5 mr-1" /> Registrar ligação
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs">Ver histórico completo</Button>
            </div>
          </Card>
        </div>

        {/* RIGHT */}
        <div className="space-y-3">
          {/* IA pré-SDR */}
          <Card className="p-4">
            <PanelTitle icon={<Bot className="h-3.5 w-3.5" />}>IA pré-SDR — análise de empresa</PanelTitle>
            <div className="rounded-lg bg-muted/60 p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-xs font-medium">Próxima da fila</span>
              </div>
              <div className="rounded-md border border-border bg-card p-2.5 space-y-2">
                <div className="text-sm font-medium">Grupo Maximus Engenharia</div>
                <div className="flex flex-wrap gap-1">
                  <Tag tone="blue">B2B</Tag>
                  <Tag tone="green">Construção civil</Tag>
                  <Tag tone="amber">251–500 func.</Tag>
                </div>
                <div className="text-xs text-muted-foreground border-l-2 border-emerald-500 pl-2 leading-relaxed">
                  Empresa cresceu 40% em 2024 e abriu 2 filiais. Site indica expansão de operações e novo ERP previsto. Momento ideal para abordagem.
                </div>
                <div className="text-[11px] text-muted-foreground">Score de propensão</div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">0</span>
                  <div className="flex-1 h-1.5 rounded-full bg-card overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: "82%" }} />
                  </div>
                  <span className="text-xs font-semibold text-emerald-600">82</span>
                </div>
              </div>
              <div className="mt-3">
                <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">
                  Pontos de entrada sugeridos
                </div>
                <div className="flex flex-wrap gap-1">
                  <Tag tone="green">Expansão recente</Tag>
                  <Tag tone="blue">Dor: gestão de equipe</Tag>
                  <Tag tone="amber">Decisor: CEO</Tag>
                </div>
              </div>
              <div className="flex gap-1.5 mt-3">
                <Button size="sm" className="h-7 text-xs flex-1">Gerar script ↗</Button>
                <Button size="sm" variant="outline" className="h-7 text-xs">Analisar ↗</Button>
              </div>
            </div>
          </Card>

          {/* Fila de prospecção */}
          <Card className="p-4">
            <PanelTitle icon={<ListOrdered className="h-3.5 w-3.5" />}>Fila de prospecção</PanelTitle>
            <div className="space-y-1.5">
              <QueueItem initials="GM" name="Grupo Maximus Eng." sub="Construção civil · SP" score={82} active />
              <QueueItem initials="RT" name="Rede Têxtil Brasil" sub="Manufatura · MG" score={74} avatarTone="green" />
              <QueueItem initials="PH" name="Pharma Distribuidora" sub="Saúde · RJ" score={69} avatarTone="amber" />
              <QueueItem initials="AG" name="Agrosul Cooperativa" sub="Agro · RS" score={61} avatarTone="orange" />
            </div>
            <Button size="sm" variant="outline" className="w-full h-7 text-xs mt-2">
              Ver fila completa <ArrowUpRight className="h-3 w-3 ml-1" />
            </Button>
          </Card>

          {/* Script ativo */}
          <Card className="p-4">
            <PanelTitle icon={<FileText className="h-3.5 w-3.5" />}>Script ativo</PanelTitle>
            <div className="rounded-md bg-muted/60 p-2.5">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Tag tone="blue">Abertura</Tag>
                <span className="text-xs font-medium">Engajamento inicial</span>
              </div>
              <p className="text-xs italic text-muted-foreground leading-relaxed">
                "Oi [Nome], aqui é [Seu Nome] da [Empresa]. Vi que vocês estão em expansão — consegui 30 segundos para te mostrar como outras empresas do setor estão resolvendo [dor]?"
              </p>
            </div>
            <div className="flex gap-1.5 mt-2 flex-wrap">
              <Suggest>Sugerir abordagem ↗</Suggest>
              <Suggest>Tratamento de objeção ↗</Suggest>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ---------- Sub-components ---------- */

function PanelTitle({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-3">
      {icon}
      {children}
    </div>
  );
}

type Tone = "blue" | "green" | "amber" | "red" | "gray" | "orange" | "teal";

const toneText: Record<Tone, string> = {
  blue: "text-blue-700 dark:text-blue-300",
  green: "text-emerald-700 dark:text-emerald-300",
  amber: "text-amber-700 dark:text-amber-300",
  red: "text-red-700 dark:text-red-300",
  gray: "text-muted-foreground",
  orange: "text-orange-700 dark:text-orange-300",
  teal: "text-teal-700 dark:text-teal-300",
};

function KPI({ label, value, suffix, sub, tone = "blue" }: { label: string; value: string; suffix?: string; sub?: string; tone?: Tone }) {
  return (
    <div className="rounded-lg bg-muted/50 px-3.5 py-3 border border-border/50">
      <div className="text-[11px] text-muted-foreground mb-1">{label}</div>
      <div className={`text-2xl font-semibold ${toneText[tone]}`}>
        {value}
        {suffix && <span className="text-sm font-medium ml-1">{suffix}</span>}
      </div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

const funnelColors: Record<Tone, string> = {
  blue: "bg-blue-200 text-blue-900 dark:bg-blue-900/50 dark:text-blue-200",
  teal: "bg-teal-200 text-teal-900 dark:bg-teal-900/50 dark:text-teal-200",
  amber: "bg-amber-200 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200",
  orange: "bg-orange-200 text-orange-900 dark:bg-orange-900/50 dark:text-orange-200",
  green: "bg-emerald-200 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-200",
  red: "bg-red-200 text-red-900",
  gray: "bg-muted text-muted-foreground",
};

function FunnelRow({ label, text, count, pct, color }: { label: string; text: string; count: number; pct: number; color: Tone }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="text-xs text-muted-foreground w-32 text-right shrink-0">{label}</div>
      <div className="flex-1 h-8 bg-muted/50 rounded-md overflow-hidden relative">
        <div className={`h-full rounded-md flex items-center px-2.5 text-xs font-medium whitespace-nowrap ${funnelColors[color]}`} style={{ width: `${pct}%` }}>
          {text}
        </div>
      </div>
      <div className="text-sm font-semibold w-9 text-right">{count}</div>
      <div className="text-[11px] text-muted-foreground w-9 text-right">{pct}%</div>
    </div>
  );
}

function Arrow() {
  return <div className="text-center text-[10px] text-muted-foreground -my-0.5">▼</div>;
}

const tagTones: Record<Tone, string> = {
  blue: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900",
  green: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
  amber: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
  red: "bg-red-50 text-red-700 border-red-200",
  gray: "bg-muted text-muted-foreground border-border",
  orange: "bg-orange-50 text-orange-700 border-orange-200",
  teal: "bg-teal-50 text-teal-700 border-teal-200",
};

function Tag({ tone = "gray", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${tagTones[tone]}`}>
      {children}
    </span>
  );
}

function Suggest({ children }: { children: React.ReactNode }) {
  return (
    <button className="text-[11px] bg-muted/50 border border-border rounded-full px-2.5 py-1 text-muted-foreground hover:bg-card hover:text-foreground transition">
      {children}
    </button>
  );
}

const dotColors = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  blue: "bg-blue-500",
  gray: "bg-muted-foreground",
};

function CallItem({ dot, name, detail, time, tag }: { dot: keyof typeof dotColors; name: string; detail: string; time: string; tag: { text: string; tone: Tone } }) {
  return (
    <div className="flex items-center gap-2 p-2 bg-muted/40 rounded-md">
      <span className={`w-2 h-2 rounded-full shrink-0 ${dotColors[dot]}`} />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate">{name}</div>
        <div className="text-[11px] text-muted-foreground truncate">{detail}</div>
      </div>
      <div className="text-[11px] text-muted-foreground shrink-0">{time}</div>
      <Tag tone={tag.tone}>{tag.text}</Tag>
    </div>
  );
}

const avatarTones = {
  blue: "bg-blue-200 text-blue-900",
  green: "bg-emerald-200 text-emerald-900",
  amber: "bg-amber-200 text-amber-900",
  orange: "bg-orange-200 text-orange-900",
};

function QueueItem({ initials, name, sub, score, active, avatarTone = "blue" }: { initials: string; name: string; sub: string; score: number; active?: boolean; avatarTone?: keyof typeof avatarTones }) {
  return (
    <div className={`flex items-center gap-2.5 p-2 rounded-md cursor-pointer border transition ${active ? "border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-900" : "border-transparent bg-muted/40 hover:border-border"}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${avatarTones[avatarTone]}`}>
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate">{name}</div>
        <div className="text-[11px] text-muted-foreground truncate">{sub}</div>
      </div>
      <div className="text-xs font-semibold text-emerald-600 shrink-0">{score}</div>
    </div>
  );
}
