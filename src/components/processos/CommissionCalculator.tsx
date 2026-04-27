import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { DollarSign, Save, TrendingUp, Calculator, Zap } from "lucide-react";
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
  }, [plans]);

  const result = calcCommission(plan, achievement, salesValue);

  const set = (k: keyof CommissionPlan, v: any) => setPlan((p) => ({ ...p, [k]: typeof v === "string" && k !== "name" && k !== "role" ? Number(v) || 0 : v }));

  const handleSave = async () => {
    try {
      await save.mutateAsync(plan);
      toast.success("Plano salvo");
    } catch (e: any) {
      toast.error("Erro", { description: e.message });
    }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <DollarSign className="h-5 w-5 text-primary" /> Plano de Comissionamento (OTE)
          </CardTitle>
          <CardDescription>Configure remuneração variável e aceleradores.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs">Nome do plano</Label>
              <Input value={plan.name} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Cargo</Label>
              <select className="w-full border rounded h-9 px-2 bg-background text-sm" value={plan.role} onChange={(e) => set("role", e.target.value)}>
                <option value="sdr">SDR</option>
                <option value="closer">Closer</option>
                <option value="gestor">Gestor</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">Salário base (R$)</Label>
              <Input type="number" value={plan.base_salary} onChange={(e) => set("base_salary", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">OTE anual (R$)</Label>
              <Input type="number" value={plan.ote_target} onChange={(e) => set("ote_target", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">% Variável do OTE</Label>
              <Input type="number" value={plan.variable_pct} onChange={(e) => set("variable_pct", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Meta Mensal (R$)</Label>
              <Input type="number" value={plan.quota_monthly} onChange={(e) => set("quota_monthly", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">% Comissão sobre vendas</Label>
              <Input type="number" step="0.1" value={plan.commission_pct} onChange={(e) => set("commission_pct", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Acelerador a partir de (%)</Label>
              <Input type="number" value={plan.accelerator_threshold} onChange={(e) => set("accelerator_threshold", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Multiplicador acelerador</Label>
              <Input type="number" step="0.1" value={plan.accelerator_multiplier} onChange={(e) => set("accelerator_multiplier", e.target.value)} />
            </div>
          </div>
          <Button onClick={handleSave} disabled={save.isPending} variant="secondary" className="w-full">
            <Save className="h-4 w-4 mr-2" /> Salvar plano
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calculator className="h-4 w-4" /> Simulador
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">Atingimento da meta: {achievement}%</Label>
              <Slider min={0} max={200} step={5} value={[achievement]} onValueChange={(v) => setAchievement(v[0])} />
            </div>
            <div>
              <Label className="text-xs">Valor vendido (R$)</Label>
              <Input type="number" value={salesValue} onChange={(e) => setSalesValue(Number(e.target.value) || 0)} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" /> Resultado do mês
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Row label="Variável-alvo mensal" value={fmtMoney(result.monthlyVariable)} />
            <Row label="Comissão base (% × vendas)" value={fmtMoney(result.baseCommission)} />
            {result.aboveThreshold && (
              <Row label={`Após acelerador ×${plan.accelerator_multiplier}`}
                value={fmtMoney(result.accelerated)}
                badge={<Badge className="bg-amber-500"><Zap className="h-3 w-3" /> Acelerado</Badge>} />
            )}
            <div className="border-t pt-2 mt-2">
              <Row label="Comissão a pagar" value={fmtMoney(result.payout)} highlight />
              <Row label="Ganho total (base + variável)" value={fmtMoney(result.totalEarnings)} highlight />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value, highlight, badge }: any) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={`text-xs ${highlight ? "font-medium" : "text-muted-foreground"}`}>{label}</span>
      <div className="flex items-center gap-1.5">
        {badge}
        <span className={`font-mono ${highlight ? "text-base font-bold text-emerald-600" : "text-sm"}`}>{value}</span>
      </div>
    </div>
  );
}
