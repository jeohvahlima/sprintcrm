import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

// Benchmark de mercado por cargo (referência: pesquisas Lukro/Reev/RDStation 2024-2025, em R$)
const BENCHMARKS = [
  { cargo: "SDR 1 (Lista fria)", fixo: 2200, total100: 3500 },
  { cargo: "SDR 2 (Inbound)",    fixo: 2800, total100: 4500 },
  { cargo: "SDR 3 (Outbound)",   fixo: 3500, total100: 6000 },
  { cargo: "Closer (Pleno)",     fixo: 4500, total100: 9000 },
  { cargo: "Gerente Comercial",  fixo: 8000, total100: 16000 },
];

interface Props {
  fixo?: number;
  variavelMeta?: number;
  aceleradores?: string;
}

export function CompensationSimulator({ fixo: fixoProp, variavelMeta: variavelProp }: Props) {
  const [fixo, setFixo] = useState<number>(fixoProp ?? 3000);
  const [variavel, setVariavel] = useState<number>(variavelProp ?? 3000);
  const [aceleradorPercent, setAceleradorPercent] = useState<number>(20);
  const [superAceleradorPercent, setSuperAceleradorPercent] = useState<number>(50);

  const data = useMemo(() => {
    const cenarios = [60, 80, 100, 120, 150];
    return cenarios.map((c) => {
      let variavelCalc: number;
      if (c < 100) {
        variavelCalc = (variavel * c) / 100;
      } else if (c <= 120) {
        // acelerador linear entre 100% e 120%
        const extra = ((c - 100) / 20) * (variavel * aceleradorPercent / 100);
        variavelCalc = variavel + extra;
      } else {
        // super acelerador acima de 120%
        const baseAcelerada = variavel * (1 + aceleradorPercent / 100);
        const extra = ((c - 120) / 30) * (variavel * superAceleradorPercent / 100);
        variavelCalc = baseAcelerada + extra;
      }
      return {
        cenario: `${c}%`,
        Fixo: fixo,
        Variável: Math.round(variavelCalc),
        Total: Math.round(fixo + variavelCalc),
      };
    });
  }, [fixo, variavel, aceleradorPercent, superAceleradorPercent]);

  const total100 = fixo + variavel;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 grid md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">Salário fixo (R$)</Label>
            <Input type="number" value={fixo} onChange={(e) => setFixo(Number(e.target.value))} />
          </div>
          <div>
            <Label className="text-xs">Variável a 100% (R$)</Label>
            <Input type="number" value={variavel} onChange={(e) => setVariavel(Number(e.target.value))} />
          </div>
          <div>
            <Label className="text-xs">Acelerador (101-120%) +%</Label>
            <Input type="number" value={aceleradorPercent} onChange={(e) => setAceleradorPercent(Number(e.target.value))} />
          </div>
          <div>
            <Label className="text-xs">Super acelerador (&gt;120%) +%</Label>
            <Input type="number" value={superAceleradorPercent} onChange={(e) => setSuperAceleradorPercent(Number(e.target.value))} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-sm">Curva de remuneração por atingimento</h4>
            <Badge variant="outline">100% meta = R$ {total100.toLocaleString("pt-BR")}</Badge>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="cenario" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                formatter={(v: any) => `R$ ${Number(v).toLocaleString("pt-BR")}`}
              />
              <ReferenceLine x="100%" stroke="hsl(var(--primary))" strokeDasharray="3 3" />
              <Line type="monotone" dataKey="Fixo" stroke="hsl(var(--muted-foreground))" strokeWidth={2} />
              <Line type="monotone" dataKey="Variável" stroke="hsl(var(--primary))" strokeWidth={2} />
              <Line type="monotone" dataKey="Total" stroke="hsl(142 71% 35%)" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <h4 className="font-semibold text-sm mb-3">Benchmark de mercado (referência)</h4>
          <div className="space-y-2">
            {BENCHMARKS.map((b) => (
              <div key={b.cargo} className="grid grid-cols-[1fr_auto_auto] gap-3 text-sm items-center">
                <span className="text-muted-foreground">{b.cargo}</span>
                <Badge variant="outline" className="text-[10px]">Fixo R$ {b.fixo.toLocaleString("pt-BR")}</Badge>
                <Badge variant="secondary" className="text-[10px]">100% R$ {b.total100.toLocaleString("pt-BR")}</Badge>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-3">
            Valores médios de mercado nacional · use como referência, não como regra.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
