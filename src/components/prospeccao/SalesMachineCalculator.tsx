import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Calculator, Save, TrendingUp, Users, Target, DollarSign,
  HelpCircle, ArrowRight, Briefcase, Phone, ChevronDown, ChevronUp,
} from "lucide-react";
import { calcSalesMachine, useSaveSalesMachine, type SalesMachineConfig } from "@/hooks/useProspectingIntelligence";
import { toast } from "sonner";

const DEFAULT: SalesMachineConfig = {
  name: "Cenário Padrão",
  revenue_goal: 100000,
  ticket_medio: 5000,
  win_rate: 25,
  meeting_show_rate: 70,
  lead_to_meeting_rate: 15,
  cycle_days: 30,
  pipeline_coverage: 3,
  sdr_capacity_per_day: 30,
  closer_capacity_per_day: 4,
};

const fmt = (n: number) => new Intl.NumberFormat("pt-BR").format(n);
const fmtMoney = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);

interface FieldProps {
  label: string;
  hint: string;
  value: number | string;
  onChange: (v: string) => void;
  prefix?: string;
  suffix?: string;
  step?: string;
  type?: string;
}

function Field({ label, hint, value, onChange, prefix, suffix, step, type = "number" }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1">
        <Label className="text-xs font-medium">{label}</Label>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[240px] text-xs">
              {hint}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">{prefix}</span>
        )}
        <Input
          type={type}
          step={step}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${prefix ? "pl-9" : ""} ${suffix ? "pr-9" : ""} h-9`}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">{suffix}</span>
        )}
      </div>
    </div>
  );
}

function StepHeader({ n, title, desc, icon: Icon }: any) {
  return (
    <div className="flex items-start gap-3 pb-3 border-b">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm shrink-0">
        {n}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

export function SalesMachineCalculator() {
  const [cfg, setCfg] = useState<SalesMachineConfig>(DEFAULT);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const result = calcSalesMachine(cfg);
  const save = useSaveSalesMachine();

  const set = (k: keyof SalesMachineConfig, v: number | string) =>
    setCfg((p) => ({ ...p, [k]: typeof v === "string" && k !== "name" ? Number(v) || 0 : v }));

  const handleSave = async () => {
    try {
      await save.mutateAsync(cfg);
      toast.success("Cenário salvo");
    } catch (e: any) {
      toast.error("Erro ao salvar", { description: e.message });
    }
  };

  return (
    <div className="grid lg:grid-cols-5 gap-4">
      {/* Configuração - 3 cols */}
      <Card className="lg:col-span-3">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calculator className="h-5 w-5 text-primary" />
            Calculadora Máquina de Vendas
          </CardTitle>
          <CardDescription className="text-xs">
            Preencha em 3 passos: meta → conversões → capacidade do time. A engenharia reversa é automática.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <Label className="text-xs">Nome do cenário</Label>
            <Input value={cfg.name} onChange={(e) => set("name", e.target.value)} className="h-9 mt-1" />
          </div>

          {/* PASSO 1 - META */}
          <div className="space-y-3">
            <StepHeader n={1} icon={Target} title="Sua meta de vendas" desc="Quanto você precisa faturar e qual o ticket médio." />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Meta de Receita (mês)" hint="Faturamento alvo no mês. Ex.: 100.000 = R$ 100 mil." value={cfg.revenue_goal} onChange={(v) => set("revenue_goal", v)} prefix="R$" />
              <Field label="Ticket Médio" hint="Valor médio por venda fechada. Some vendas e divida pelo nº de contratos." value={cfg.ticket_medio} onChange={(v) => set("ticket_medio", v)} prefix="R$" />
            </div>
          </div>

          {/* PASSO 2 - CONVERSÕES */}
          <div className="space-y-3">
            <StepHeader n={2} icon={TrendingUp} title="Suas taxas de conversão" desc="Quanto % avança em cada etapa do funil." />
            <div className="grid grid-cols-3 gap-3">
              <Field label="Lead → Reunião" hint="De cada 100 leads qualificados, quantos viram reunião agendada?" value={cfg.lead_to_meeting_rate} onChange={(v) => set("lead_to_meeting_rate", v)} suffix="%" />
              <Field label="Show Rate" hint="De cada 100 reuniões agendadas, quantas o lead aparece (não dá no-show)?" value={cfg.meeting_show_rate} onChange={(v) => set("meeting_show_rate", v)} suffix="%" />
              <Field label="Win Rate" hint="De cada 100 reuniões realizadas, quantas viram venda fechada?" value={cfg.win_rate} onChange={(v) => set("win_rate", v)} suffix="%" />
            </div>
          </div>

          {/* PASSO 3 - TIME */}
          <div className="space-y-3">
            <StepHeader n={3} icon={Users} title="Capacidade do time" desc="Quantas atividades cada vendedor consegue por dia." />
            <div className="grid grid-cols-2 gap-3">
              <Field label="SDR: leads/dia" hint="Quantos leads um SDR consegue prospectar por dia." value={cfg.sdr_capacity_per_day} onChange={(v) => set("sdr_capacity_per_day", v)} suffix="leads" />
              <Field label="Closer: reuniões/dia" hint="Quantas reuniões um Closer consegue realizar por dia." value={cfg.closer_capacity_per_day} onChange={(v) => set("closer_capacity_per_day", v)} suffix="reun." />
            </div>
          </div>

          {/* AVANÇADO */}
          <button
            type="button"
            onClick={() => setShowAdvanced((s) => !s)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showAdvanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            Configurações avançadas
          </button>
          {showAdvanced && (
            <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-muted/30 border border-dashed">
              <Field label="Ciclo (dias úteis)" hint="Dias úteis entre primeiro contato e fechamento." value={cfg.cycle_days} onChange={(v) => set("cycle_days", v)} suffix="dias" />
              <Field label="Pipeline Coverage" hint="Multiplicador de pipeline x meta. Mercado usa 3x." value={cfg.pipeline_coverage} onChange={(v) => set("pipeline_coverage", v)} suffix="x" step="0.1" />
            </div>
          )}

          <Button onClick={handleSave} disabled={save.isPending} className="w-full" variant="secondary">
            <Save className="h-4 w-4 mr-2" /> Salvar cenário
          </Button>
        </CardContent>
      </Card>

      {/* Resultado - 2 cols */}
      <div className="lg:col-span-2 space-y-3">
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Engenharia Reversa
            </CardTitle>
            <CardDescription className="text-xs">Para bater a meta de {fmtMoney(cfg.revenue_goal)} você precisa:</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <FunnelRow icon={DollarSign} label="Vendas fechadas" value={fmt(result.sales_needed)} accent="text-emerald-600" />
            <FunnelArrow pct={cfg.win_rate} label="win rate" />
            <FunnelRow icon={Briefcase} label="Reuniões realizadas" value={fmt(Math.ceil(result.sales_needed / Math.max(cfg.win_rate, 1) * 100))} />
            <FunnelArrow pct={cfg.meeting_show_rate} label="show rate" />
            <FunnelRow icon={Phone} label="Reuniões agendadas" value={fmt(result.meetings_needed)} />
            <FunnelArrow pct={cfg.lead_to_meeting_rate} label="lead→reun" />
            <FunnelRow icon={Users} label="Leads necessários" value={fmt(result.leads_needed)} accent="text-primary" big />
            <div className="pt-2 mt-2 border-t flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Pipeline alvo ({cfg.pipeline_coverage}x)</span>
              <span className="text-sm font-mono font-semibold">{fmtMoney(result.pipeline_value)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4 text-emerald-500" /> Time necessário
            </CardTitle>
            <CardDescription className="text-xs">Para suportar esse volume em {cfg.cycle_days} dias úteis.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg border bg-card text-center">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">SDRs</p>
              <p className="text-3xl font-bold text-emerald-600 my-1">{Math.ceil(result.sdrs_needed || 0)}</p>
              <p className="text-[10px] text-muted-foreground">({result.sdrs_needed} ideal)</p>
            </div>
            <div className="p-3 rounded-lg border bg-card text-center">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Closers</p>
              <p className="text-3xl font-bold text-emerald-600 my-1">{Math.ceil(result.closers_needed || 0)}</p>
              <p className="text-[10px] text-muted-foreground">({result.closers_needed} ideal)</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FunnelRow({ icon: Icon, label, value, accent, big }: any) {
  return (
    <div className="flex items-center justify-between p-2 rounded-md bg-card/50 border">
      <div className="flex items-center gap-2">
        <Icon className={`h-3.5 w-3.5 ${accent || "text-muted-foreground"}`} />
        <span className="text-xs">{label}</span>
      </div>
      <span className={`font-mono font-bold ${big ? "text-lg" : "text-sm"} ${accent || ""}`}>{value}</span>
    </div>
  );
}

function FunnelArrow({ pct, label }: { pct: number; label: string }) {
  return (
    <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
      <ArrowRight className="h-3 w-3 rotate-90" />
      <span>{pct}% {label}</span>
    </div>
  );
}
