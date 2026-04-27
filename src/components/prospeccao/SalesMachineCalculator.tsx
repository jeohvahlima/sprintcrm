import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calculator, Save, TrendingUp, Users, Target, DollarSign } from "lucide-react";
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

export function SalesMachineCalculator() {
  const [cfg, setCfg] = useState<SalesMachineConfig>(DEFAULT);
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
    <div className="grid lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Calculator className="h-5 w-5 text-primary" />
            Calculadora Máquina de Vendas
          </CardTitle>
          <CardDescription>Da meta de receita até o número de SDRs necessário.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">Nome do cenário</Label>
            <Input value={cfg.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Meta de Receita (mês)</Label>
              <Input type="number" value={cfg.revenue_goal} onChange={(e) => set("revenue_goal", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Ticket Médio</Label>
              <Input type="number" value={cfg.ticket_medio} onChange={(e) => set("ticket_medio", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Win Rate (%)</Label>
              <Input type="number" value={cfg.win_rate} onChange={(e) => set("win_rate", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Show Rate Reuniões (%)</Label>
              <Input type="number" value={cfg.meeting_show_rate} onChange={(e) => set("meeting_show_rate", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Lead → Reunião (%)</Label>
              <Input type="number" value={cfg.lead_to_meeting_rate} onChange={(e) => set("lead_to_meeting_rate", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Ciclo (dias úteis)</Label>
              <Input type="number" value={cfg.cycle_days} onChange={(e) => set("cycle_days", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Pipeline Coverage (x)</Label>
              <Input type="number" step="0.1" value={cfg.pipeline_coverage} onChange={(e) => set("pipeline_coverage", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Capacidade SDR/dia</Label>
              <Input type="number" value={cfg.sdr_capacity_per_day} onChange={(e) => set("sdr_capacity_per_day", e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Capacidade Closer/dia (reuniões)</Label>
              <Input type="number" value={cfg.closer_capacity_per_day} onChange={(e) => set("closer_capacity_per_day", e.target.value)} />
            </div>
          </div>
          <Button onClick={handleSave} disabled={save.isPending} className="w-full" variant="secondary">
            <Save className="h-4 w-4 mr-2" /> Salvar cenário
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Resultado da Engenharia Reversa
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Metric icon={DollarSign} label="Vendas necessárias" value={fmt(result.sales_needed)} hint={`@ ${fmtMoney(cfg.ticket_medio)}`} />
            <Metric icon={Target} label="Reuniões agendadas" value={fmt(result.meetings_needed)} hint={`Show rate ${cfg.meeting_show_rate}%`} />
            <Metric icon={Users} label="Leads necessários" value={fmt(result.leads_needed)} hint={`${cfg.lead_to_meeting_rate}% viram reunião`} />
            <Metric icon={DollarSign} label="Pipeline alvo" value={fmtMoney(result.pipeline_value)} hint={`${cfg.pipeline_coverage}x da meta`} />
          </CardContent>
        </Card>

        <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4 text-emerald-500" /> Time necessário
            </CardTitle>
            <CardDescription className="text-xs">Baseado em capacidade × dias úteis do ciclo.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg border bg-card">
              <p className="text-xs text-muted-foreground">SDRs</p>
              <p className="text-3xl font-bold text-emerald-600">{result.sdrs_needed}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{cfg.sdr_capacity_per_day}/dia × {cfg.cycle_days}d</p>
            </div>
            <div className="p-3 rounded-lg border bg-card">
              <p className="text-xs text-muted-foreground">Closers</p>
              <p className="text-3xl font-bold text-emerald-600">{result.closers_needed}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{cfg.closer_capacity_per_day} reuniões/dia</p>
            </div>
            <Badge variant="secondary" className="col-span-2 justify-center text-xs py-1.5">
              Arredonde para cima ao planejar contratação
            </Badge>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, hint }: any) {
  return (
    <div className="p-3 rounded-lg border bg-card">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <p className="text-xl font-bold mt-1">{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}
