import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DollarSign, Save, TrendingUp, Calculator, Zap, HelpCircle,
  Target, Award, Briefcase, Wallet,
} from "lucide-react";
import { calcCommission, useCommissionPlans, useSaveCommissionPlan, type CommissionPlan } from "@/hooks/useProcessIntel";
import { toast } from "sonner";

const DEFAULT: CommissionPlan = {
  name: "Plano Closer Padrão",
  role: "closer",
  base_salary: 3000,
  ote_target: 120000,
  variable_pct: 50,
  quota_monthly: 100000,
  commission_pct: 5,
  accelerator_threshold: 100,
  accelerator_multiplier: 1.5,
  stage_kickers: { reuniao_realizada: 50, proposta_enviada: 100 },
  is_active: true,
};

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n || 0);

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
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 font-semibold text-sm shrink-0">
        {n}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-emerald-600" />
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

export function CommissionCalculator() {
  const { data: plans } = useCommissionPlans();
  const save = useSaveCommissionPlan();
  const [plan, setPlan] = useState<CommissionPlan>(DEFAULT);
  const [achievement, setAchievement] = useState(100);
  const [salesValue, setSalesValue] = useState(100000);

  useEffect(() => {
    if (plans && plans.length > 0 && !plan.id) {
      setPlan(plans[0]);
      setSalesValue(plans[0].quota_monthly);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plans]);

  const result = calcCommission(plan, achievement, salesValue);

  const set = (k: keyof CommissionPlan, v: any) =>
    setPlan((p) => ({ ...p, [k]: typeof v === "string" && k !== "name" && k !== "role" ? Number(v) || 0 : v }));

  const handleSave = async () => {
    try {
      await save.mutateAsync(plan);
      toast.success("Plano salvo");
    } catch (e: any) {
      toast.error("Erro", { description: e.message });
    }
  };

  return (
    <div className="grid lg:grid-cols-5 gap-4">
      {/* Configuração - 3 cols */}
      <Card className="lg:col-span-3">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <DollarSign className="h-5 w-5 text-emerald-600" />
            Plano de Comissionamento (OTE)
          </CardTitle>
          <CardDescription className="text-xs">
            Configure remuneração variável, meta e aceleradores em 3 passos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Label className="text-xs">Nome do plano</Label>
              <Input value={plan.name} onChange={(e) => set("name", e.target.value)} className="h-9 mt-1" />
            </div>
            <div>
              <Label className="text-xs">Cargo</Label>
              <select
                className="w-full border rounded-md h-9 px-2 bg-background text-sm mt-1"
                value={plan.role}
                onChange={(e) => set("role", e.target.value)}
              >
                <option value="sdr">SDR</option>
                <option value="closer">Closer</option>
                <option value="gestor">Gestor</option>
              </select>
            </div>
          </div>

          {/* PASSO 1 - REMUNERAÇÃO BASE */}
          <div className="space-y-3">
            <StepHeader n={1} icon={Briefcase} title="Remuneração base e OTE" desc="Salário fixo e ganho total esperado no ano." />
            <div className="grid grid-cols-3 gap-3">
              <Field label="Salário base (mês)" hint="Valor fixo mensal pago independente da meta." value={plan.base_salary} onChange={(v) => set("base_salary", v)} prefix="R$" />
              <Field label="OTE anual" hint="On-Target Earnings: ganho total esperado no ano se bater 100% da meta (base + variável)." value={plan.ote_target} onChange={(v) => set("ote_target", v)} prefix="R$" />
              <Field label="% Variável" hint="Quanto % do OTE vem da parte variável (comissão). Padrão de mercado: 40-60%." value={plan.variable_pct} onChange={(v) => set("variable_pct", v)} suffix="%" />
            </div>
          </div>

          {/* PASSO 2 - META E COMISSÃO */}
          <div className="space-y-3">
            <StepHeader n={2} icon={Target} title="Meta e comissão" desc="Quanto vender e quanto ganhar por venda." />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Meta Mensal" hint="Quota mensal de vendas que o vendedor precisa atingir." value={plan.quota_monthly} onChange={(v) => set("quota_monthly", v)} prefix="R$" />
              <Field label="% Comissão sobre vendas" hint="Percentual aplicado sobre o valor vendido. Ex: 5% de R$100k = R$5k." value={plan.commission_pct} onChange={(v) => set("commission_pct", v)} suffix="%" step="0.1" />
            </div>
          </div>

          {/* PASSO 3 - ACELERADOR */}
          <div className="space-y-3">
            <StepHeader n={3} icon={Zap} title="Acelerador (super meta)" desc="Multiplicador para quem ultrapassa a meta." />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Acelera a partir de" hint="A partir de qual % de atingimento o multiplicador entra. Ex: 100% = quando bater meta." value={plan.accelerator_threshold} onChange={(v) => set("accelerator_threshold", v)} suffix="%" />
              <Field label="Multiplicador" hint="Quanto a comissão é multiplicada acima do gatilho. Ex: 1.5x = 50% a mais." value={plan.accelerator_multiplier} onChange={(v) => set("accelerator_multiplier", v)} suffix="x" step="0.1" />
            </div>
          </div>

          <Button onClick={handleSave} disabled={save.isPending} variant="secondary" className="w-full">
            <Save className="h-4 w-4 mr-2" /> Salvar plano
          </Button>
        </CardContent>
      </Card>

      {/* Resultado - 2 cols */}
      <div className="lg:col-span-2 space-y-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calculator className="h-4 w-4" /> Simulador
            </CardTitle>
            <CardDescription className="text-xs">Ajuste para simular ganhos no mês.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs">Atingimento da meta</Label>
                <Badge variant={achievement >= plan.accelerator_threshold ? "default" : "secondary"} className={achievement >= plan.accelerator_threshold ? "bg-emerald-600" : ""}>
                  {achievement}%
                </Badge>
              </div>
              <Slider min={0} max={200} step={5} value={[achievement]} onValueChange={(v) => setAchievement(v[0])} />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>0%</span><span>100%</span><span>200%</span>
              </div>
            </div>
            <div>
              <Label className="text-xs">Valor vendido no mês</Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                <Input type="number" value={salesValue} onChange={(e) => setSalesValue(Number(e.target.value) || 0)} className="pl-9 h-9" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Resultado - destaque */}
        <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" /> Resultado do mês
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <ResultBox icon={Wallet} label="Salário base" value={fmtMoney(plan.base_salary)} />
              <ResultBox
                icon={Award}
                label={result.aboveThreshold ? "Comissão (acelerada)" : "Comissão"}
                value={fmtMoney(result.payout)}
                accent
                badge={result.aboveThreshold ? `×${plan.accelerator_multiplier}` : undefined}
              />
            </div>
            <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Ganho total no mês</p>
              <p className="text-3xl font-bold text-emerald-600 mt-1">{fmtMoney(result.totalEarnings)}</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                Variável-alvo: {fmtMoney(result.monthlyVariable)} • Base bruta: {fmtMoney(result.baseCommission)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ResultBox({ icon: Icon, label, value, accent, badge }: any) {
  return (
    <div className={`p-3 rounded-lg border ${accent ? "bg-card border-emerald-500/30" : "bg-card"}`}>
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1">
          <Icon className={`h-3 w-3 ${accent ? "text-emerald-600" : "text-muted-foreground"}`} />
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{label}</span>
        </div>
        {badge && <Badge className="bg-amber-500 text-[9px] h-4 px-1"><Zap className="h-2.5 w-2.5" />{badge}</Badge>}
      </div>
      <p className={`font-bold mt-1 ${accent ? "text-base text-emerald-600" : "text-sm"}`}>{value}</p>
    </div>
  );
}
