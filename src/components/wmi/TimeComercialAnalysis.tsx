import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Users, DollarSign, TrendingUp, AlertTriangle, CheckCircle2, Target, UserPlus } from "lucide-react";
import { calcularTimeAnalysis, type DoresDesejos } from "@/hooks/useDiagnostico360";

const fmt = (n: number) => `R$ ${Math.round(n).toLocaleString("pt-BR")}`;
const fmtN = (n: number, dec = 1) => Number(n.toFixed(dec)).toLocaleString("pt-BR");

interface InputsProps {
  dores: DoresDesejos;
  setDores: (d: DoresDesejos) => void;
}

/** Bloco de inputs no STEP "dores" */
export function TimeComercialInputs({ dores, setDores }: InputsProps) {
  const analysis = calcularTimeAnalysis(dores);
  const set = (k: keyof DoresDesejos, v: any) =>
    setDores({ ...dores, [k]: v === "" ? undefined : Number(v) || undefined });

  return (
    <div className="border-2 border-blue-500/30 rounded-lg p-4 space-y-3 bg-gradient-to-br from-blue-500/5 to-cyan-500/5">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-blue-500" />
        <Label className="text-sm font-semibold">Time comercial — custo, produção e ROI</Label>
      </div>
      <p className="text-[11px] text-muted-foreground -mt-1">
        Quantos vendedores você tem, quanto custam e quanto produzem. Calculamos se o time está se pagando.
      </p>

      {/* Estrutura */}
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Qtd. SDRs / Atendentes</Label>
          <Input type="number" placeholder="2"
            value={dores.qtd_sdrs ?? ""}
            onChange={(e) => set("qtd_sdrs", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Qtd. Closers / Vendedores</Label>
          <Input type="number" placeholder="3"
            value={dores.qtd_closers ?? ""}
            onChange={(e) => set("qtd_closers", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Custo estrutura / mês (R$)<br/>
            <span className="text-muted-foreground text-[10px]">gestor, ferramentas, comissões fixas</span>
          </Label>
          <Input type="number" placeholder="5000"
            value={dores.custo_estrutura_mes ?? ""}
            onChange={(e) => set("custo_estrutura_mes", e.target.value)} />
        </div>
      </div>

      {/* Custos por pessoa */}
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Custo médio SDR / mês (R$)</Label>
          <Input type="number" placeholder="3500"
            value={dores.custo_sdr_mes ?? ""}
            onChange={(e) => set("custo_sdr_mes", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Custo médio Closer / mês (R$)</Label>
          <Input type="number" placeholder="6000"
            value={dores.custo_closer_mes ?? ""}
            onChange={(e) => set("custo_closer_mes", e.target.value)} />
        </div>
      </div>

      {/* Produção por pessoa */}
      <div className="grid sm:grid-cols-3 gap-3 pt-2 border-t border-blue-500/20">
        <div className="space-y-1">
          <Label className="text-xs">Leads por SDR / dia</Label>
          <Input type="number" placeholder="20"
            value={dores.prod_sdr_leads_dia ?? ""}
            onChange={(e) => set("prod_sdr_leads_dia", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Reuniões por Closer / dia</Label>
          <Input type="number" placeholder="3"
            value={dores.prod_closer_reunioes_dia ?? ""}
            onChange={(e) => set("prod_closer_reunioes_dia", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Vendas por Closer / mês</Label>
          <Input type="number" placeholder="5"
            value={dores.prod_closer_vendas_mes ?? ""}
            onChange={(e) => set("prod_closer_vendas_mes", e.target.value)} />
        </div>
      </div>

      {/* Prévia rápida */}
      {analysis ? (
        <div className="grid sm:grid-cols-4 gap-2 pt-3 border-t border-blue-500/20">
          <div className="text-center">
            <div className="text-[10px] text-muted-foreground uppercase">Custo do time/mês</div>
            <div className="text-sm font-bold text-rose-600">{fmt(analysis.custo_mensal_time)}</div>
          </div>
          <div className="text-center">
            <div className="text-[10px] text-muted-foreground uppercase">Receita gerada/mês</div>
            <div className="text-sm font-bold text-emerald-600">{fmt(analysis.receita_mes_time)}</div>
          </div>
          <div className="text-center">
            <div className="text-[10px] text-muted-foreground uppercase">Margem</div>
            <div className={`text-sm font-bold ${analysis.margem_mensal >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {fmt(analysis.margem_mensal)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[10px] text-muted-foreground uppercase">ROI</div>
            <div className={`text-sm font-bold ${analysis.roi_pct >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {fmtN(analysis.roi_pct, 0)}%
            </div>
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground italic">
          Preencha quantidade de pessoas e custos para ver se o time se paga.
        </p>
      )}
    </div>
  );
}

/** Card de resultado completo no STEP "result" */
export function TimeComercialResultCard({ result }: { result: DoresDesejos }) {
  const a = calcularTimeAnalysis(result);
  if (!a) return null;

  const valePena = a.vale_a_pena;
  const eficienciaPct = a.custo_mensal_time > 0
    ? Math.min(200, (a.receita_mes_time / a.custo_mensal_time) * 100)
    : 0;

  return (
    <Card className="border-2 overflow-hidden">
      <div className={`h-2 bg-gradient-to-r ${valePena ? "from-emerald-500 to-green-400" : "from-rose-500 to-orange-400"}`} />
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-5 w-5 text-blue-500" />
          Análise do Time Comercial
          <Badge className={valePena ? "bg-emerald-500" : "bg-rose-500"}>
            {valePena ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <AlertTriangle className="h-3 w-3 mr-1" />}
            {valePena ? "O time se paga" : "O time não se paga"}
          </Badge>
        </CardTitle>
        <CardDescription>
          {a.qtd_total} {a.qtd_total === 1 ? "pessoa" : "pessoas"} · custo {fmt(a.custo_mensal_time)}/mês ·
          gera {fmt(a.receita_mes_time)}/mês
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Resumo financeiro */}
        <div className="grid sm:grid-cols-4 gap-3">
          <div className="border rounded-lg p-3 text-center bg-rose-500/5">
            <DollarSign className="h-4 w-4 mx-auto text-rose-500 mb-1" />
            <div className="text-[10px] uppercase text-muted-foreground">Custo total/mês</div>
            <div className="text-lg font-bold text-rose-600">{fmt(a.custo_mensal_time)}</div>
            <div className="text-[10px] text-muted-foreground">{fmt(a.custo_anual_time)} / ano</div>
          </div>
          <div className="border rounded-lg p-3 text-center bg-emerald-500/5">
            <TrendingUp className="h-4 w-4 mx-auto text-emerald-500 mb-1" />
            <div className="text-[10px] uppercase text-muted-foreground">Receita gerada/mês</div>
            <div className="text-lg font-bold text-emerald-600">{fmt(a.receita_mes_time)}</div>
            <div className="text-[10px] text-muted-foreground">{fmt(a.receita_dia_time)} / dia</div>
          </div>
          <div className="border rounded-lg p-3 text-center">
            <div className="text-[10px] uppercase text-muted-foreground">Margem mensal</div>
            <div className={`text-lg font-bold ${a.margem_mensal >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {fmt(a.margem_mensal)}
            </div>
            <div className="text-[10px] text-muted-foreground">receita − custo</div>
          </div>
          <div className="border rounded-lg p-3 text-center">
            <div className="text-[10px] uppercase text-muted-foreground">ROI do time</div>
            <div className={`text-lg font-bold ${a.roi_pct >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {fmtN(a.roi_pct, 0)}%
            </div>
            <Progress value={Math.max(0, Math.min(100, eficienciaPct / 2))} className="h-1 mt-1" />
          </div>
        </div>

        {/* Produção por papel */}
        <div className="grid md:grid-cols-2 gap-3">
          {(Number(result.qtd_sdrs) || 0) > 0 && (
            <div className="border rounded-lg p-3 bg-blue-500/5">
              <div className="text-xs font-semibold text-blue-600 mb-2">📞 Produção por SDR / Atendente</div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div><div className="text-[10px] text-muted-foreground">Dia</div><div className="font-bold">{fmtN(a.sdr_leads_dia, 0)}</div></div>
                <div><div className="text-[10px] text-muted-foreground">Semana</div><div className="font-bold">{fmtN(a.sdr_leads_semana, 0)}</div></div>
                <div><div className="text-[10px] text-muted-foreground">Mês</div><div className="font-bold">{fmtN(a.sdr_leads_mes, 0)}</div></div>
              </div>
              <div className="text-[10px] text-muted-foreground mt-2 text-center">
                Time todo: <strong>{fmtN(a.leads_mes_total, 0)} leads/mês</strong> · custo/lead: <strong>{fmt(a.custo_por_lead)}</strong>
              </div>
            </div>
          )}
          {(Number(result.qtd_closers) || 0) > 0 && (
            <div className="border rounded-lg p-3 bg-emerald-500/5">
              <div className="text-xs font-semibold text-emerald-600 mb-2">🎯 Produção por Closer / Vendedor</div>
              <div className="space-y-1">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div><div className="text-[10px] text-muted-foreground">Reuniões/dia</div><div className="font-bold">{fmtN(a.closer_reunioes_dia, 0)}</div></div>
                  <div><div className="text-[10px] text-muted-foreground">Reuniões/sem</div><div className="font-bold">{fmtN(a.closer_reunioes_semana, 0)}</div></div>
                  <div><div className="text-[10px] text-muted-foreground">Reuniões/mês</div><div className="font-bold">{fmtN(a.closer_reunioes_mes, 0)}</div></div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center pt-1 border-t">
                  <div><div className="text-[10px] text-muted-foreground">Vendas/dia</div><div className="font-bold">{fmtN(a.closer_vendas_dia, 1)}</div></div>
                  <div><div className="text-[10px] text-muted-foreground">Vendas/sem</div><div className="font-bold">{fmtN(a.closer_vendas_semana, 1)}</div></div>
                  <div><div className="text-[10px] text-muted-foreground">Vendas/mês</div><div className="font-bold">{fmtN(a.closer_vendas_mes, 0)}</div></div>
                </div>
              </div>
              <div className="text-[10px] text-muted-foreground mt-2 text-center">
                Custo por venda: <strong>{fmt(a.custo_por_venda)}</strong>
                {a.custo_por_reuniao > 0 && <> · por reunião: <strong>{fmt(a.custo_por_reuniao)}</strong></>}
              </div>
            </div>
          )}
        </div>

        {/* Gap para meta */}
        {a.vendas_meta_mes > 0 && a.gap_vendas_mes > 0 && (
          <div className="border-2 border-amber-500/30 rounded-lg p-4 bg-gradient-to-br from-amber-500/10 to-orange-500/5">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-amber-600" />
              <div className="text-sm font-semibold text-amber-700">Quanto o time precisa produzir a mais</div>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <div className="text-[10px] uppercase text-muted-foreground">Vendas/mês para meta</div>
                <div className="text-lg font-bold">{fmtN(a.vendas_meta_mes, 0)}</div>
                <div className="text-[10px] text-muted-foreground">hoje produzem {fmtN(a.vendas_mes_total, 0)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-muted-foreground">GAP de vendas</div>
                <div className="text-lg font-bold text-amber-600">+{fmtN(a.gap_vendas_mes, 0)} vendas/mês</div>
                <div className="text-[10px] text-muted-foreground">{fmt(a.receita_extra_necessaria)} de receita extra</div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-muted-foreground">Closers adicionais</div>
                <div className="text-lg font-bold text-blue-600 flex items-center gap-1">
                  <UserPlus className="h-4 w-4" /> +{a.closers_adicionais_necessarios}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  ou aumentar produção/closer em {a.closer_vendas_mes > 0 ? Math.round((a.gap_vendas_mes / (Number(result.qtd_closers) || 1) / a.closer_vendas_mes) * 100) : 0}%
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Veredito */}
        <div className={`border rounded-lg p-3 text-sm ${valePena ? "bg-emerald-500/10 border-emerald-500/30" : "bg-rose-500/10 border-rose-500/30"}`}>
          {valePena ? (
            <span>✅ <strong>Vale a pena manter este time.</strong> Cada R$ 1 investido retorna R$ {fmtN(1 + a.roi_pct / 100, 2)}.
              {a.gap_vendas_mes > 0 && <> Para chegar à meta, foque em <strong>aumentar produção</strong> ou expandir o time.</>}
            </span>
          ) : (
            <span>⚠️ <strong>Atenção: o time está custando mais do que produz.</strong> Revise produtividade, aumente ticket médio,
              corte custos fixos ou redimensione a estrutura antes de contratar mais pessoas.</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
