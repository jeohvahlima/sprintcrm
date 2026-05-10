import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calculator, Target, Users, TrendingUp, AlertCircle, CheckCircle2, Sparkles } from "lucide-react";

// ================================================================
// GROW SALES INTELLIGENCE — Calculadora de Cenários, KPIs Ideais
// e Dimensionamento de Time Comercial.
// (Substitui referência à Full Sales — agora 100% Grow Sales OS)
// ================================================================

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtNum = (v: number) => Math.round(v).toLocaleString("pt-BR");
const fmtPct = (v: number) => `${v.toFixed(1)}%`;

// Capacidades de referência (Grow Sales Intelligence)
const SDR_CAPACITY_PER_MONTH = 750;        // leads tratados / SDR / mês
const CLOSER_CAPACITY_PER_MONTH = 90;      // reuniões fechadas / Closer / mês

// KPIs ideais Grow Sales Intelligence
const KPI_IDEAL = {
  contactTimeMin: { ideal: 5, label: "Tempo até 1º contato", unit: "min", lowerIsBetter: true },
  bookingRate:    { ideal: 20, label: "Taxa de Agendamento", unit: "%" },
  attendanceRate: { ideal: 65, label: "Taxa de Comparecimento", unit: "%" },
  conversionRate: { ideal: 27, label: "Taxa de Conversão (Closer)", unit: "%", range: [20, 35] as const },
  roas:           { ideal: 7,  label: "ROAS", unit: "x" },
} as const;

type KpiKey = keyof typeof KPI_IDEAL;

interface ScenarioInputs {
  investment: number;     // R$ / mês em mídia
  cpl: number;            // custo por lead
  bookingRate: number;    // %
  attendanceRate: number; // %
  conversionRate: number; // %
  ticket: number;         // ticket médio R$
}

const DEFAULT_SCENARIO: ScenarioInputs = {
  investment: 30000,
  cpl: 35,
  bookingRate: 18,
  attendanceRate: 60,
  conversionRate: 22,
  ticket: 3500,
};

function computeScenario(s: ScenarioInputs) {
  const leads = s.cpl > 0 ? s.investment / s.cpl : 0;
  const meetings = leads * (s.bookingRate / 100);
  const attended = meetings * (s.attendanceRate / 100);
  const sales = attended * (s.conversionRate / 100);
  const revenue = sales * s.ticket;
  const cac = sales > 0 ? s.investment / sales : 0;
  const roas = s.investment > 0 ? revenue / s.investment : 0;
  const sdrs = leads / SDR_CAPACITY_PER_MONTH;
  const closers = attended / CLOSER_CAPACITY_PER_MONTH;
  return { leads, meetings, attended, sales, revenue, cac, roas, sdrs, closers };
}

function kpiStatus(key: KpiKey, value: number) {
  const k = KPI_IDEAL[key];
  if ("range" in k && k.range) {
    if (value >= k.range[0] && value <= k.range[1]) return "ok" as const;
    if (value >= k.range[0] * 0.7) return "warn" as const;
    return "bad" as const;
  }
  if ("lowerIsBetter" in k && k.lowerIsBetter) {
    if (value <= k.ideal) return "ok" as const;
    if (value <= k.ideal * 2) return "warn" as const;
    return "bad" as const;
  }
  if (value >= k.ideal) return "ok" as const;
  if (value >= k.ideal * 0.7) return "warn" as const;
  return "bad" as const;
}

const STATUS_STYLE = {
  ok:   { color: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/30", icon: CheckCircle2, label: "Saudável" },
  warn: { color: "text-amber-500",   bg: "bg-amber-500/10 border-amber-500/30",     icon: AlertCircle,  label: "Atenção" },
  bad:  { color: "text-rose-500",    bg: "bg-rose-500/10 border-rose-500/30",       icon: AlertCircle,  label: "Crítico" },
};

export function GrowSalesIntelligence() {
  const [s, setS] = useState<ScenarioInputs>(DEFAULT_SCENARIO);
  const r = useMemo(() => computeScenario(s), [s]);

  // Time real (input do usuário)
  const [actualSdrs, setActualSdrs] = useState(1);
  const [actualClosers, setActualClosers] = useState(1);

  // KPIs reais (puxam da própria simulação por padrão; podem ser editados)
  const [kpiContactMin, setKpiContactMin] = useState(15);

  const update = (k: keyof ScenarioInputs) => (v: number) =>
    setS((p) => ({ ...p, [k]: v }));

  const sdrGap = r.sdrs - actualSdrs;
  const closerGap = r.closers - actualClosers;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold">Grow Sales Intelligence</h2>
            <Badge className="bg-gradient-to-r from-primary to-primary/70 text-primary-foreground">Beta</Badge>
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Simulador de cenários comerciais, comparador de KPIs ideais e dimensionamento de time
            (SDRs &amp; Closers) baseado na operação Grow Sales OS.
          </p>
        </div>
      </div>

      <Tabs defaultValue="calc" className="space-y-4">
        <TabsList>
          <TabsTrigger value="calc" className="gap-2"><Calculator className="h-4 w-4" /> Calculadora de Cenários</TabsTrigger>
          <TabsTrigger value="kpis" className="gap-2"><Target className="h-4 w-4" /> KPIs Atuais vs. Ideais</TabsTrigger>
          <TabsTrigger value="dim"  className="gap-2"><Users className="h-4 w-4" /> Dimensionamento de Time</TabsTrigger>
        </TabsList>

        {/* ============ CALCULADORA ============ */}
        <TabsContent value="calc">
          <div className="grid lg:grid-cols-5 gap-4">
            {/* Inputs */}
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle className="text-base">Variáveis do Cenário</CardTitle>
                <CardDescription>Ajuste os parâmetros e veja o impacto em tempo real.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <SliderField label="Investimento em mídia / mês" value={s.investment} min={1000} max={500000} step={1000} format={fmtBRL} onChange={update("investment")} />
                <SliderField label="Custo por Lead (CPL)"        value={s.cpl}        min={1}    max={500}    step={1}    format={fmtBRL} onChange={update("cpl")} />
                <SliderField label="Taxa de Agendamento"          value={s.bookingRate}    min={1} max={60} step={0.5} format={(v)=>fmtPct(v)} onChange={update("bookingRate")} />
                <SliderField label="Taxa de Comparecimento (Show)" value={s.attendanceRate} min={20} max={95} step={1}  format={(v)=>fmtPct(v)} onChange={update("attendanceRate")} />
                <SliderField label="Taxa de Conversão (Closer)"   value={s.conversionRate} min={1}  max={70} step={0.5} format={(v)=>fmtPct(v)} onChange={update("conversionRate")} />
                <SliderField label="Ticket Médio"                  value={s.ticket}     min={100} max={100000} step={100} format={fmtBRL} onChange={update("ticket")} />
              </CardContent>
            </Card>

            {/* Outputs */}
            <Card className="lg:col-span-2 border-2 border-primary/30">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" /> Resultado projetado
                </CardTitle>
                <CardDescription>Mensal · Grow Sales Intelligence</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Stat label="Leads gerados" value={fmtNum(r.leads)} highlight />
                <Stat label="Reuniões agendadas" value={fmtNum(r.meetings)} />
                <Stat label="Reuniões realizadas" value={fmtNum(r.attended)} />
                <Stat label="Vendas" value={fmtNum(r.sales)} highlight />
                <div className="pt-2 mt-2 border-t space-y-3">
                  <Stat label="Faturamento" value={fmtBRL(r.revenue)} big />
                  <div className="grid grid-cols-2 gap-3">
                    <Stat label="CAC" value={fmtBRL(r.cac)} />
                    <Stat label="ROAS" value={`${r.roas.toFixed(2)}x`} status={r.roas >= 7 ? "ok" : r.roas >= 4 ? "warn" : "bad"} />
                  </div>
                </div>
                <div className="pt-2 mt-2 border-t space-y-3">
                  <Stat label="SDRs necessários" value={r.sdrs.toFixed(1)} hint={`${SDR_CAPACITY_PER_MONTH} leads/mês cada`} />
                  <Stat label="Closers necessários" value={r.closers.toFixed(1)} hint={`${CLOSER_CAPACITY_PER_MONTH} reuniões/mês cada`} />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ============ KPIs ============ */}
        <TabsContent value="kpis">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Comparador de KPIs — Atual vs. Ideal</CardTitle>
              <CardDescription>Benchmarks Grow Sales Intelligence para operações high-ticket B2B/B2C.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <KpiRow keyName="contactTimeMin" actual={kpiContactMin} onChange={setKpiContactMin} />
              <KpiRow keyName="bookingRate"    actual={s.bookingRate} onChange={(v)=>update("bookingRate")(v)} />
              <KpiRow keyName="attendanceRate" actual={s.attendanceRate} onChange={(v)=>update("attendanceRate")(v)} />
              <KpiRow keyName="conversionRate" actual={s.conversionRate} onChange={(v)=>update("conversionRate")(v)} />
              <KpiRow keyName="roas"           actual={r.roas} readOnly />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ DIMENSIONAMENTO ============ */}
        <TabsContent value="dim">
          <div className="grid md:grid-cols-2 gap-4">
            <DimensionCard
              role="SDR / Pré-vendas"
              capacity={SDR_CAPACITY_PER_MONTH}
              capacityLabel="leads / mês"
              required={r.sdrs}
              actual={actualSdrs}
              onChange={setActualSdrs}
              gap={sdrGap}
            />
            <DimensionCard
              role="Closer / Vendedor"
              capacity={CLOSER_CAPACITY_PER_MONTH}
              capacityLabel="reuniões realizadas / mês"
              required={r.closers}
              actual={actualClosers}
              onChange={setActualClosers}
              gap={closerGap}
            />
          </div>

          <Card className="mt-4 border-primary/30">
            <CardHeader>
              <CardTitle className="text-base">Diagnóstico Grow Sales Intelligence</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                Para sustentar <b>{fmtNum(r.leads)} leads</b> e <b>{fmtNum(r.attended)} reuniões realizadas</b>/mês,
                seu time ideal é <b>{r.sdrs.toFixed(1)} SDR(s)</b> e <b>{r.closers.toFixed(1)} Closer(s)</b>.
              </p>
              {sdrGap > 0.3 && (
                <p className="text-amber-500">⚠ Faltam ~{Math.ceil(sdrGap)} SDR(s) — risco de leads não tratados no SLA de 5 min.</p>
              )}
              {closerGap > 0.3 && (
                <p className="text-amber-500">⚠ Faltam ~{Math.ceil(closerGap)} Closer(s) — agenda travada reduzirá taxa de show e conversão.</p>
              )}
              {sdrGap < -0.5 && (
                <p className="text-emerald-500">✓ Capacidade ociosa em SDR — espaço para escalar mídia ou revisar CPL.</p>
              )}
              {closerGap < -0.5 && (
                <p className="text-emerald-500">✓ Capacidade ociosa em Closer — agressividade no agendamento pode escalar receita.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============ Subcomponents ============

function SliderField({ label, value, min, max, step, format, onChange }: {
  label: string; value: number; min: number; max: number; step: number;
  format: (v: number) => string; onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm">{label}</Label>
        <span className="text-sm font-mono font-semibold text-primary">{format(value)}</span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={(v) => onChange(v[0])} />
    </div>
  );
}

function Stat({ label, value, hint, big, highlight, status }: {
  label: string; value: string; hint?: string; big?: boolean; highlight?: boolean;
  status?: "ok" | "warn" | "bad";
}) {
  const statusColor = status ? STATUS_STYLE[status].color : "";
  return (
    <div className="flex items-center justify-between gap-2">
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        {hint && <div className="text-[10px] text-muted-foreground/70">{hint}</div>}
      </div>
      <div className={`font-mono font-semibold ${big ? "text-2xl" : highlight ? "text-lg" : "text-base"} ${statusColor || (highlight ? "text-primary" : "")}`}>
        {value}
      </div>
    </div>
  );
}

function KpiRow({ keyName, actual, onChange, readOnly }: {
  keyName: KpiKey; actual: number; onChange?: (v: number) => void; readOnly?: boolean;
}) {
  const k = KPI_IDEAL[keyName];
  const status = kpiStatus(keyName, actual);
  const sty = STATUS_STYLE[status];
  const Icon = sty.icon;
  const idealLabel = "range" in k && k.range ? `${k.range[0]}–${k.range[1]}${k.unit}` : `${k.ideal}${k.unit}`;

  return (
    <div className={`p-3 rounded-lg border ${sty.bg} flex items-center gap-3 flex-wrap`}>
      <Icon className={`h-5 w-5 ${sty.color}`} />
      <div className="flex-1 min-w-[140px]">
        <div className="font-medium text-sm">{k.label}</div>
        <div className="text-xs text-muted-foreground">Ideal: {idealLabel}</div>
      </div>
      <div className="flex items-center gap-2">
        {readOnly ? (
          <span className="font-mono font-semibold">{actual.toFixed(2)}{k.unit}</span>
        ) : (
          <Input
            type="number"
            value={actual}
            onChange={(e) => onChange?.(Number(e.target.value))}
            className="w-24 h-8 font-mono"
          />
        )}
        <Badge variant="outline" className={sty.color}>{sty.label}</Badge>
      </div>
    </div>
  );
}

function DimensionCard({ role, capacity, capacityLabel, required, actual, onChange, gap }: {
  role: string; capacity: number; capacityLabel: string; required: number;
  actual: number; onChange: (v: number) => void; gap: number;
}) {
  const pct = required > 0 ? Math.min(100, (actual / required) * 100) : 100;
  const status: "ok" | "warn" | "bad" = gap <= 0.3 ? "ok" : gap <= 1 ? "warn" : "bad";
  const sty = STATUS_STYLE[status];
  return (
    <Card className={`border-2 ${sty.bg}`}>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2"><Users className="h-4 w-4" /> {role}</span>
          <Badge variant="outline" className={sty.color}>{sty.label}</Badge>
        </CardTitle>
        <CardDescription>Capacidade: {capacity} {capacityLabel}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Stat label="Necessário (Grow Sales Intelligence)" value={required.toFixed(1)} highlight />
        <div className="space-y-1">
          <Label className="text-xs">Time atual</Label>
          <Input type="number" min={0} step={1} value={actual} onChange={(e) => onChange(Number(e.target.value))} className="font-mono" />
        </div>
        <Progress value={pct} className="h-2" />
        <div className="text-xs text-muted-foreground">
          {gap > 0.3
            ? `Gap: faltam ~${Math.ceil(gap)} pessoa(s).`
            : gap < -0.5
              ? `Folga: ~${Math.abs(Math.floor(gap))} pessoa(s) acima do necessário.`
              : `Time alinhado com a operação projetada.`}
        </div>
      </CardContent>
    </Card>
  );
}
