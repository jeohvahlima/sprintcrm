import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Trash2, Plus, Target, DollarSign, TrendingUp, Users, AlertTriangle, Save, Layers,
  Sparkles, Briefcase, BadgePercent, Loader2, Activity, Gauge, Repeat, Zap, PiggyBank,
  Scale, Phone, CalendarCheck, Trophy, Rocket, HelpCircle, CalendarDays, CalendarRange,
  Info,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useSalesMachineConfigs, useSaveSalesMachine, type SalesMachineConfig } from "@/hooks/useProspectingIntelligence";
import { useProdutosServicos, useRevenueOffers, useUpsertOffer, useDeleteOffer, computeOffer, type RevenueOffer } from "@/hooks/useRevenueEngine";
import { toast } from "sonner";

const fmt = (n: number) => new Intl.NumberFormat("pt-BR").format(Math.round(n));
const money = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n || 0);

const DEFAULT_CFG: SalesMachineConfig & { sdrs_team?: number; closers_team?: number } = {
  name: "Plano de Receita",
  revenue_goal: 100000,
  ticket_medio: 5000,
  win_rate: 25,
  meeting_show_rate: 70,
  lead_to_meeting_rate: 15,
  cycle_days: 22,
  pipeline_coverage: 3,
  sdr_capacity_per_day: 30,
  closer_capacity_per_day: 4,
};

const newOffer = (configId: string, position: number): RevenueOffer & { config_id: string } => ({
  config_id: configId,
  name: "Nova oferta",
  ticket: 5000,
  margin_pct: 60,
  target_sales: 5,
  lead_to_meeting_rate: 15,
  meeting_show_rate: 70,
  win_rate: 25,
  cac: 800,
  position,
});

// Helper: label com tooltip explicativo
function HLabel({ label, hint }: { label: string; hint: string }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1 cursor-help">
            {label} <HelpCircle className="h-3 w-3 text-muted-foreground/70" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">{hint}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function RevenueMixEngine() {
  const { data: configs } = useSalesMachineConfigs();
  const saveCfg = useSaveSalesMachine();
  const [cfg, setCfg] = useState<SalesMachineConfig>(DEFAULT_CFG);

  // Metas locais (não persistem ainda) — número de pessoas e período
  const [sdrsTeam, setSdrsTeam] = useState(1);
  const [closersTeam, setClosersTeam] = useState(1);
  const [periodo, setPeriodo] = useState<"diaria" | "semanal" | "mensal" | "trimestral" | "anual">("mensal");

  useEffect(() => {
    if (configs && configs.length > 0 && !cfg.id) {
      setCfg(configs[0]);
    }
  }, [configs]);

  const { data: produtos } = useProdutosServicos();
  const { data: offersDb } = useRevenueOffers(cfg.id);
  const upsertOffer = useUpsertOffer();
  const delOffer = useDeleteOffer(cfg.id || "");

  const [draftOffers, setDraftOffers] = useState<(RevenueOffer & { _localId?: string })[]>([]);
  useEffect(() => { setDraftOffers((offersDb as any) || []); }, [offersDb]);

  const offers = draftOffers.map(computeOffer);

  const totals = useMemo(() => {
    const receita = offers.reduce((s, o) => s + o.receita, 0);
    const margem = offers.reduce((s, o) => s + o.margem_valor, 0);
    const cac = offers.reduce((s, o) => s + o.cac_total, 0);
    const lucro = margem - cac;
    const leads = offers.reduce((s, o) => s + o.leads, 0);
    const reunioesAg = offers.reduce((s, o) => s + o.reunioes_agendadas, 0);
    const reunioesReal = offers.reduce((s, o) => s + o.reunioes_realizadas, 0);
    const vendas = offers.reduce((s, o) => s + o.target_sales, 0);
    const metaPct = cfg.revenue_goal > 0 ? (receita / cfg.revenue_goal) * 100 : 0;
    const sdrs = cfg.sdr_capacity_per_day > 0 ? leads / (cfg.sdr_capacity_per_day * Math.max(cfg.cycle_days, 1)) : 0;
    const closers = cfg.closer_capacity_per_day > 0 ? reunioesAg / (cfg.closer_capacity_per_day * Math.max(cfg.cycle_days, 1)) : 0;
    const maxReceita = Math.max(0, ...offers.map(o => o.receita));
    const dependencia = receita > 0 ? (maxReceita / receita) * 100 : 0;
    const ticketMedioPond = vendas > 0 ? receita / vendas : 0;
    const margemPct = receita > 0 ? (margem / receita) * 100 : 0;
    const roi = cac > 0 ? (lucro / cac) * 100 : 0;
    const ltvProxy = ticketMedioPond * (margemPct / 100);
    const ltvCac = vendas > 0 && cac > 0 ? ltvProxy / (cac / vendas) : 0;
    const cacUnit = vendas > 0 ? cac / vendas : 0;
    const paybackMeses = cacUnit > 0 && ticketMedioPond > 0 ? cacUnit / (ticketMedioPond * (margemPct / 100) || 1) : 0;
    const vendasDia = cfg.cycle_days > 0 ? vendas / cfg.cycle_days : 0;
    const leadsDia = cfg.cycle_days > 0 ? leads / cfg.cycle_days : 0;
    const reunioesDia = cfg.cycle_days > 0 ? reunioesAg / cfg.cycle_days : 0;
    const velocity = cfg.cycle_days > 0 ? receita / cfg.cycle_days : 0;
    const pipelineAlvo = receita * cfg.pipeline_coverage;
    const conversaoGlobal = leads > 0 ? (vendas / leads) * 100 : 0;
    const custoPorLead = leads > 0 ? cac / leads : 0;
    const custoPorReuniao = reunioesAg > 0 ? cac / reunioesAg : 0;
    const capSdrLeadsCiclo = cfg.sdr_capacity_per_day * cfg.cycle_days;
    const capCloserReunCiclo = cfg.closer_capacity_per_day * cfg.cycle_days;
    const utilSdr = capSdrLeadsCiclo > 0 ? (leads / capSdrLeadsCiclo) * 100 : 0;
    const utilCloser = capCloserReunCiclo > 0 ? (reunioesAg / capCloserReunCiclo) * 100 : 0;
    return {
      receita, margem, cac, lucro, leads, reunioesAg, reunioesReal, vendas, metaPct, sdrs, closers, dependencia,
      ticketMedioPond, margemPct, roi, ltvProxy, ltvCac, cacUnit, paybackMeses,
      vendasDia, leadsDia, reunioesDia, velocity, pipelineAlvo, conversaoGlobal,
      custoPorLead, custoPorReuniao, utilSdr, utilCloser,
    };
  }, [offers, cfg]);

  // Conversão de meta por período (assumindo o mês configurado em cfg.cycle_days dias úteis)
  const metasPorPeriodo = useMemo(() => {
    const diasMes = Math.max(cfg.cycle_days, 1);
    // base: valores mensais
    const base = {
      receita: totals.receita,
      vendas: totals.vendas,
      reunioes: totals.reunioesAg,
      leads: totals.leads,
    };
    const mult = {
      diaria: 1 / diasMes,
      semanal: 5 / diasMes, // semana = 5 dias úteis
      mensal: 1,
      trimestral: 3,
      anual: 12,
    } as const;
    const m = mult[periodo];
    return {
      receita: base.receita * m,
      vendas: base.vendas * m,
      reunioes: base.reunioes * m,
      leads: base.leads * m,
    };
  }, [totals, cfg.cycle_days, periodo]);

  // Meta por pessoa (SDR e Closer)
  const metasPorPessoa = useMemo(() => {
    const sdrCount = Math.max(sdrsTeam, 1);
    const closerCount = Math.max(closersTeam, 1);
    const diasMes = Math.max(cfg.cycle_days, 1);
    return {
      // SDR é responsável por leads/reuniões agendadas
      sdr: {
        leadsMes: totals.leads / sdrCount,
        leadsDia: (totals.leads / sdrCount) / diasMes,
        leadsSemana: ((totals.leads / sdrCount) / diasMes) * 5,
        reunioesMes: totals.reunioesAg / sdrCount,
        reunioesDia: (totals.reunioesAg / sdrCount) / diasMes,
      },
      closer: {
        vendasMes: totals.vendas / closerCount,
        vendasDia: (totals.vendas / closerCount) / diasMes,
        vendasSemana: ((totals.vendas / closerCount) / diasMes) * 5,
        receitaMes: totals.receita / closerCount,
        receitaDia: (totals.receita / closerCount) / diasMes,
        reunioesMes: totals.reunioesReal / closerCount,
      },
    };
  }, [totals, sdrsTeam, closersTeam, cfg.cycle_days]);

  const handleSaveCfg = async () => {
    try {
      await saveCfg.mutateAsync(cfg);
      toast.success("Cenário salvo");
    } catch (e: any) { toast.error("Erro ao salvar", { description: e.message }); }
  };

  const handleAddOffer = async () => {
    if (!cfg.id) { toast.error("Salve o cenário antes de adicionar ofertas"); return; }
    try {
      await upsertOffer.mutateAsync(newOffer(cfg.id, draftOffers.length));
    } catch (e: any) { toast.error("Erro ao criar oferta", { description: e.message }); }
  };

  const handleImportProduto = async (produtoId: string) => {
    if (!cfg.id) { toast.error("Salve o cenário antes"); return; }
    const p = produtos?.find(x => x.id === produtoId);
    if (!p) return;
    try {
      await upsertOffer.mutateAsync({
        ...newOffer(cfg.id, draftOffers.length),
        name: p.nome,
        ticket: Number(p.preco_sugerido) || 0,
        produto_servico_id: p.id,
      });
    } catch (e: any) { toast.error("Erro", { description: e.message }); }
  };

  const handleUpdateOffer = (idx: number, patch: Partial<RevenueOffer>) => {
    setDraftOffers(prev => prev.map((o, i) => i === idx ? { ...o, ...patch } : o));
  };

  const handlePersistOffer = async (idx: number) => {
    if (!cfg.id) return;
    const o = draftOffers[idx];
    try { await upsertOffer.mutateAsync({ ...o, config_id: cfg.id }); } catch (e: any) { toast.error("Erro", { description: e.message }); }
  };

  const handleDeleteOffer = async (idx: number) => {
    const o = draftOffers[idx];
    if (!o.id) { setDraftOffers(prev => prev.filter((_, i) => i !== idx)); return; }
    try { await delOffer.mutateAsync(o.id); } catch (e: any) { toast.error("Erro", { description: e.message }); }
  };

  return (
    <div className="space-y-4">
      {/* PASSO 1 — Defina sua meta de faturamento */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-transparent to-transparent">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="h-5 w-5 text-primary" /> Passo 1 — Defina a meta de faturamento
                <Badge className="bg-gradient-to-r from-primary to-primary/70 text-primary-foreground gap-1">
                  <Sparkles className="h-3 w-3" /> Engenharia de Receita
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                Diga quanto quer faturar no mês. O sistema calcula sozinho metas diárias, semanais, trimestrais e anuais.
              </CardDescription>
            </div>
            {configs && configs.length > 0 && (
              <Select value={cfg.id || ""} onValueChange={(v) => {
                const c = configs.find(x => x.id === v); if (c) setCfg(c);
              }}>
                <SelectTrigger className="w-56 h-9 text-xs"><SelectValue placeholder="Selecionar cenário" /></SelectTrigger>
                <SelectContent>{configs.map(c => <SelectItem key={c.id} value={c.id!}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>
        <CardContent className="grid md:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">Nome do plano</Label>
            <Input className="h-9 mt-1" value={cfg.name} onChange={(e) => setCfg({ ...cfg, name: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs flex items-center gap-1">
              <HLabel label="Meta de receita do MÊS (R$)" hint="Quanto sua empresa quer faturar em 1 mês. Tudo é calculado a partir desse número." />
            </Label>
            <Input className="h-9 mt-1" type="number" value={cfg.revenue_goal}
              onChange={(e) => setCfg({ ...cfg, revenue_goal: Number(e.target.value) })} />
          </div>
          <div>
            <Label className="text-xs">
              <HLabel label="Dias úteis no mês" hint="Quantos dias por mês o time efetivamente vende. Padrão: 22." />
            </Label>
            <Input className="h-9 mt-1" type="number" value={cfg.cycle_days}
              onChange={(e) => setCfg({ ...cfg, cycle_days: Number(e.target.value) })} />
          </div>
          <div className="flex items-end">
            <Button onClick={handleSaveCfg} disabled={saveCfg.isPending} className="w-full gap-1">
              {saveCfg.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar plano
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* PASSO 2 — Meta convertida por período */}
      <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-transparent">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-sm flex items-center gap-2">
                <CalendarRange className="h-4 w-4 text-emerald-600" /> Passo 2 — Sua meta em cada período
              </CardTitle>
              <CardDescription className="text-xs">Veja o que precisa entregar por dia, semana, mês, trimestre ou ano.</CardDescription>
            </div>
            <Select value={periodo} onValueChange={(v: any) => setPeriodo(v)}>
              <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="diaria">Diária</SelectItem>
                <SelectItem value="semanal">Semanal</SelectItem>
                <SelectItem value="mensal">Mensal</SelectItem>
                <SelectItem value="trimestral">Trimestral</SelectItem>
                <SelectItem value="anual">Anual</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <BigGoal icon={DollarSign} label="Faturamento" value={money(metasPorPeriodo.receita)} accent="text-emerald-600" />
          <BigGoal icon={Trophy} label="Vendas fechadas" value={fmt(metasPorPeriodo.vendas)} accent="text-primary" />
          <BigGoal icon={CalendarCheck} label="Reuniões agendadas" value={fmt(metasPorPeriodo.reunioes)} />
          <BigGoal icon={Users} label="Leads gerados" value={fmt(metasPorPeriodo.leads)} accent="text-violet-600" />
        </CardContent>
      </Card>

      {/* PASSO 3 — Portfólio de ofertas */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-sm flex items-center gap-2">
                <Briefcase className="h-4 w-4" /> Passo 3 — Portfólio de Ofertas
              </CardTitle>
              <CardDescription className="text-xs">
                Cadastre cada produto/serviço que vai vender. O sistema soma a receita de tudo.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {produtos && produtos.length > 0 && (
                <Select onValueChange={handleImportProduto}>
                  <SelectTrigger className="h-8 text-xs w-56"><SelectValue placeholder="Importar de Produtos…" /></SelectTrigger>
                  <SelectContent>
                    {produtos.map(p => <SelectItem key={p.id} value={p.id}>{p.nome} — {money(Number(p.preco_sugerido) || 0)}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              <Button size="sm" onClick={handleAddOffer} disabled={upsertOffer.isPending} className="gap-1">
                <Plus className="h-3 w-3" /> Oferta
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Legenda */}
          <div className="mb-3 p-2.5 rounded-md border bg-muted/30 text-[11px] text-muted-foreground flex items-start gap-2">
            <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-primary" />
            <div className="space-y-0.5">
              <div><strong>Lead → Reunião %</strong>: de cada 100 leads, quantos viram reunião agendada.</div>
              <div><strong>Show %</strong>: dos que agendaram, quantos comparecem (taxa de comparecimento).</div>
              <div><strong>Win %</strong>: das reuniões realizadas, quantas viram venda fechada.</div>
              <div><strong>CAC</strong>: custo de aquisição por cliente (marketing + vendas ÷ vendas).</div>
            </div>
          </div>

          {offers.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              Nenhuma oferta cadastrada. Adicione manualmente ou importe de Produtos.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground border-b">
                  <tr className="text-left">
                    <th className="py-2 pr-2">Oferta</th>
                    <th className="py-2 px-1"><HLabel label="Ticket" hint="Preço médio cobrado por venda dessa oferta." /></th>
                    <th className="py-2 px-1"><HLabel label="Margem %" hint="Margem bruta após custos diretos do produto/serviço (sem vendas)." /></th>
                    <th className="py-2 px-1"><HLabel label="Meta vendas" hint="Quantas vendas dessa oferta você quer fechar no mês." /></th>
                    <th className="py-2 px-1"><HLabel label="Lead→Reun %" hint="De cada 100 leads, quantos viram reunião agendada." /></th>
                    <th className="py-2 px-1"><HLabel label="Show %" hint="Quantos % dos agendados comparecem na reunião." /></th>
                    <th className="py-2 px-1"><HLabel label="Win %" hint="Taxa de fechamento sobre as reuniões realizadas." /></th>
                    <th className="py-2 px-1"><HLabel label="CAC" hint="Custo médio para conquistar 1 cliente nessa oferta." /></th>
                    <th className="py-2 px-1 text-right">Receita</th>
                    <th className="py-2 px-1 text-right">Leads</th>
                    <th className="py-2 px-1 text-right">Lucro</th>
                    <th className="py-2 pl-1"></th>
                  </tr>
                </thead>
                <tbody>
                  {offers.map((o, idx) => (
                    <tr key={o.id || idx} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="py-1.5 pr-2 min-w-[160px]">
                        <Input className="h-8 text-xs" value={o.name}
                          onChange={(e) => handleUpdateOffer(idx, { name: e.target.value })}
                          onBlur={() => handlePersistOffer(idx)} />
                      </td>
                      <td className="px-1"><NumCell value={o.ticket} onChange={(v) => handleUpdateOffer(idx, { ticket: v })} onBlur={() => handlePersistOffer(idx)} /></td>
                      <td className="px-1"><NumCell value={o.margin_pct} onChange={(v) => handleUpdateOffer(idx, { margin_pct: v })} onBlur={() => handlePersistOffer(idx)} /></td>
                      <td className="px-1"><NumCell value={o.target_sales} onChange={(v) => handleUpdateOffer(idx, { target_sales: v })} onBlur={() => handlePersistOffer(idx)} /></td>
                      <td className="px-1"><NumCell value={o.lead_to_meeting_rate} onChange={(v) => handleUpdateOffer(idx, { lead_to_meeting_rate: v })} onBlur={() => handlePersistOffer(idx)} /></td>
                      <td className="px-1"><NumCell value={o.meeting_show_rate} onChange={(v) => handleUpdateOffer(idx, { meeting_show_rate: v })} onBlur={() => handlePersistOffer(idx)} /></td>
                      <td className="px-1"><NumCell value={o.win_rate} onChange={(v) => handleUpdateOffer(idx, { win_rate: v })} onBlur={() => handlePersistOffer(idx)} /></td>
                      <td className="px-1"><NumCell value={o.cac} onChange={(v) => handleUpdateOffer(idx, { cac: v })} onBlur={() => handlePersistOffer(idx)} /></td>
                      <td className="px-1 text-right font-mono font-semibold text-emerald-600">{money(o.receita)}</td>
                      <td className="px-1 text-right font-mono">{fmt(o.leads)}</td>
                      <td className={`px-1 text-right font-mono ${o.lucro_liquido >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{money(o.lucro_liquido)}</td>
                      <td className="pl-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDeleteOffer(idx)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* PASSO 4 — Metas individuais por SDR e Closer */}
      <Card className="border-violet-500/30 bg-gradient-to-br from-violet-500/5 to-transparent">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4 text-violet-600" /> Passo 4 — Metas por pessoa do time
          </CardTitle>
          <CardDescription className="text-xs">
            Diga quantos SDRs e Closers você tem. Calculamos a meta INDIVIDUAL de cada um.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-3">
            <div className="p-2 rounded border bg-card/50">
              <Label className="text-xs">
                <HLabel label="Quantos SDRs no time?" hint="SDR = Sales Development Rep. Quem prospecta, qualifica leads e agenda reuniões." />
              </Label>
              <Input type="number" min={1} className="h-9 mt-1" value={sdrsTeam}
                onChange={(e) => setSdrsTeam(Math.max(1, Number(e.target.value)))} />
            </div>
            <div className="p-2 rounded border bg-card/50">
              <Label className="text-xs">
                <HLabel label="Quantos Closers/Vendedores?" hint="Closer = quem realiza a reunião, faz a proposta e fecha a venda." />
              </Label>
              <Input type="number" min={1} className="h-9 mt-1" value={closersTeam}
                onChange={(e) => setClosersTeam(Math.max(1, Number(e.target.value)))} />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            {/* SDR */}
            <div className="rounded-lg border bg-card p-3 space-y-2">
              <div className="flex items-center gap-2 pb-2 border-b">
                <Phone className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-semibold">Meta por SDR</span>
                <Badge variant="outline" className="ml-auto text-[10px]">{sdrsTeam} pessoa(s)</Badge>
              </div>
              <Row k="Leads / dia" v={metasPorPessoa.sdr.leadsDia.toFixed(1)} accent />
              <Row k="Leads / semana" v={fmt(metasPorPessoa.sdr.leadsSemana)} />
              <Row k="Leads / mês" v={fmt(metasPorPessoa.sdr.leadsMes)} />
              <div className="pt-2 border-t" />
              <Row k="Reuniões agendadas / dia" v={metasPorPessoa.sdr.reunioesDia.toFixed(1)} />
              <Row k="Reuniões agendadas / mês" v={fmt(metasPorPessoa.sdr.reunioesMes)} accent />
            </div>

            {/* Closer */}
            <div className="rounded-lg border bg-card p-3 space-y-2">
              <div className="flex items-center gap-2 pb-2 border-b">
                <Trophy className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-semibold">Meta por Closer/Vendedor</span>
                <Badge variant="outline" className="ml-auto text-[10px]">{closersTeam} pessoa(s)</Badge>
              </div>
              <Row k="Vendas / dia" v={metasPorPessoa.closer.vendasDia.toFixed(2)} accent />
              <Row k="Vendas / semana" v={metasPorPessoa.closer.vendasSemana.toFixed(1)} />
              <Row k="Vendas / mês" v={fmt(metasPorPessoa.closer.vendasMes)} />
              <div className="pt-2 border-t" />
              <Row k="Faturamento / mês" v={money(metasPorPessoa.closer.receitaMes)} accent />
              <Row k="Faturamento / dia" v={money(metasPorPessoa.closer.receitaDia)} />
              <Row k="Reuniões realizadas / mês" v={fmt(metasPorPessoa.closer.reunioesMes)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* PASSO 5 — Capacidade necessária */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Gauge className="h-4 w-4 text-primary" /> Passo 5 — Capacidade necessária do time
          </CardTitle>
          <CardDescription className="text-xs">
            Veja quantos SDRs e Closers IDEAIS você precisa, dado o volume de trabalho diário de cada um.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">
                <HLabel label="Capacidade SDR (leads trabalhados/dia)" hint="Quantos leads cada SDR consegue prospectar por dia útil. Média de mercado: 25–40." />
              </Label>
              <Input className="h-8 mt-1" type="number" value={cfg.sdr_capacity_per_day}
                onChange={(e) => setCfg({ ...cfg, sdr_capacity_per_day: Number(e.target.value) })} onBlur={handleSaveCfg} />
            </div>
            <div>
              <Label className="text-xs">
                <HLabel label="Capacidade Closer (reuniões/dia)" hint="Quantas reuniões de vendas cada Closer consegue realizar por dia. Média: 3–5." />
              </Label>
              <Input className="h-8 mt-1" type="number" value={cfg.closer_capacity_per_day}
                onChange={(e) => setCfg({ ...cfg, closer_capacity_per_day: Number(e.target.value) })} onBlur={handleSaveCfg} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg border bg-card">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase text-muted-foreground">SDRs necessários (ideal)</p>
                <Badge variant={totals.utilSdr > 100 ? "destructive" : totals.utilSdr > 80 ? "secondary" : "outline"} className="text-[9px] h-4">
                  {totals.utilSdr.toFixed(0)}% utilização
                </Badge>
              </div>
              <p className="text-2xl font-bold text-emerald-600">{Math.ceil(totals.sdrs)}</p>
              <Progress value={Math.min(totals.utilSdr, 100)} className="h-1.5 mt-1" />
              <p className="text-[10px] text-muted-foreground mt-1">Cálculo exato: {totals.sdrs.toFixed(2)} SDR</p>
            </div>
            <div className="p-3 rounded-lg border bg-card">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase text-muted-foreground">Closers necessários (ideal)</p>
                <Badge variant={totals.utilCloser > 100 ? "destructive" : totals.utilCloser > 80 ? "secondary" : "outline"} className="text-[9px] h-4">
                  {totals.utilCloser.toFixed(0)}% utilização
                </Badge>
              </div>
              <p className="text-2xl font-bold text-emerald-600">{Math.ceil(totals.closers)}</p>
              <Progress value={Math.min(totals.utilCloser, 100)} className="h-1.5 mt-1" />
              <p className="text-[10px] text-muted-foreground mt-1">Cálculo exato: {totals.closers.toFixed(2)} Closer</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 pt-2 border-t">
            <Mini icon={Phone} label="Custo/lead" value={money(totals.custoPorLead)} />
            <Mini icon={CalendarCheck} label="Custo/reunião" value={money(totals.custoPorReuniao)} />
            <Mini icon={Trophy} label="Custo/venda (CAC)" value={money(totals.cacUnit)} />
          </div>
        </CardContent>
      </Card>

      {/* Resumo financeiro avançado (recolhido visualmente) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" /> Resumo financeiro & saúde do funil
          </CardTitle>
          <CardDescription className="text-xs">Indicadores avançados — passe o mouse em cada métrica para entender.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SmartKPI icon={Target} label="Receita projetada" value={money(totals.receita)} sub={`Meta: ${money(cfg.revenue_goal)} • ${totals.metaPct.toFixed(0)}%`} accent="text-emerald-600" hint="Soma da receita de todas as ofertas. Comparada à meta do mês." progress={Math.min(totals.metaPct, 100)} />
          <SmartKPI icon={DollarSign} label="Margem bruta" value={money(totals.margem)} sub={`${totals.margemPct.toFixed(1)}% da receita`} hint="Quanto sobra da receita após custos diretos das ofertas (ainda sem custo de vendas)." />
          <SmartKPI icon={Briefcase} label="CAC total" value={money(totals.cac)} sub={`Por venda: ${money(totals.cacUnit)}`} hint="Custo total de aquisição (marketing + vendas). 'Por venda' é o CAC unitário." />
          <SmartKPI icon={TrendingUp} label="Lucro líquido" value={money(totals.lucro)} sub={`ROI ${totals.roi.toFixed(0)}%`} accent={totals.lucro >= 0 ? "text-emerald-600" : "text-rose-600"} hint="Margem bruta menos CAC. ROI = lucro ÷ CAC." />

          <SmartKPI icon={Scale} label="Ticket médio" value={money(totals.ticketMedioPond)} hint="Ticket médio ponderado considerando o mix de ofertas (mais vendas pesam mais)." accent="text-indigo-600" />
          <SmartKPI icon={PiggyBank} label="LTV / CAC" value={`${totals.ltvCac.toFixed(2)}x`} sub={totals.ltvCac >= 3 ? "Saudável (≥ 3x)" : totals.ltvCac >= 1 ? "Atenção" : "Crítico"} accent={totals.ltvCac >= 3 ? "text-emerald-600" : totals.ltvCac >= 1 ? "text-amber-600" : "text-rose-600"} hint="Quanto o cliente vale comparado ao custo de adquirir. Saudável: ≥ 3x." />
          <SmartKPI icon={Repeat} label="Payback do CAC" value={`${totals.paybackMeses.toFixed(1)} meses`} accent={totals.paybackMeses <= 6 ? "text-emerald-600" : "text-amber-600"} hint="Em quantos meses o cliente paga de volta o custo de aquisição. Ideal: ≤ 6 meses." />
          <SmartKPI icon={Activity} label="Conversão Lead→Venda" value={`${totals.conversaoGlobal.toFixed(1)}%`} hint="Taxa total: de cada 100 leads, quantos viram venda fechada." />

          <SmartKPI icon={Zap} label="Velocidade de receita" value={`${money(totals.velocity)}/dia`} accent="text-violet-600" hint="Receita média gerada por dia útil." />
          <SmartKPI icon={Gauge} label="Pipeline alvo" value={money(totals.pipelineAlvo)} sub={`${cfg.pipeline_coverage}× cobertura`} hint="Volume total de oportunidades em aberto recomendado para garantir a meta." />
          <SmartKPI icon={CalendarDays} label="Vendas / dia útil" value={totals.vendasDia.toFixed(2)} hint="Quantas vendas em média o time inteiro precisa fechar por dia útil." />
          <SmartKPI icon={BadgePercent} label="% da meta" value={`${totals.metaPct.toFixed(0)}%`} progress={Math.min(totals.metaPct, 100)} accent={totals.metaPct >= 100 ? "text-emerald-600" : "text-amber-600"} hint="Quanto da meta o mix atual de ofertas cobre." />
        </CardContent>
      </Card>

      {/* Alerta de dependência */}
      {totals.dependencia >= 70 && offers.length > 1 && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="p-3 flex items-center gap-2 text-xs">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span><strong>{totals.dependencia.toFixed(0)}%</strong> da meta depende de uma única oferta. Risco de concentração — diversifique o mix.</span>
          </CardContent>
        </Card>
      )}

      {/* Mix por oferta — concentração de receita */}
      {offers.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Layers className="h-4 w-4 text-primary" /> Mix de Receita por Oferta</CardTitle>
            <CardDescription className="text-xs">Concentração de receita e contribuição de cada oferta no resultado.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {offers
              .map(o => ({ ...o, share: totals.receita > 0 ? (o.receita / totals.receita) * 100 : 0 }))
              .sort((a, b) => b.share - a.share)
              .map(o => (
                <div key={o.id || o.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium truncate max-w-[60%]">{o.name}</span>
                    <span className="font-mono text-muted-foreground">
                      {money(o.receita)} <span className="text-primary font-semibold ml-2">{o.share.toFixed(1)}%</span>
                    </span>
                  </div>
                  <Progress value={o.share} className="h-2" />
                </div>
              ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function BigGoal({ icon: Icon, label, value, accent }: any) {
  return (
    <div className="p-4 rounded-lg border bg-card/70 hover:shadow-sm transition-shadow">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-[10px] uppercase tracking-wide font-medium">{label}</span>
      </div>
      <p className={`text-2xl font-bold mt-2 ${accent || ""}`}>{value}</p>
    </div>
  );
}

function Mini({ icon: Icon, label, value }: any) {
  return (
    <div className="p-2 rounded-md border bg-card/50">
      <div className="flex items-center gap-1 text-muted-foreground">
        <Icon className="h-3 w-3" />
        <span className="text-[9px] uppercase">{label}</span>
      </div>
      <p className="text-sm font-bold mt-0.5">{value}</p>
    </div>
  );
}

function SmartKPI({ icon: Icon, label, value, accent, sub, progress, hint }: any) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Card className="cursor-help">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Icon className="h-3.5 w-3.5" />
                <span className="text-[10px] uppercase tracking-wide">{label}</span>
                {hint && <HelpCircle className="h-3 w-3 ml-auto opacity-60" />}
              </div>
              <p className={`text-lg font-bold mt-1 ${accent || ""}`}>{value}</p>
              {typeof progress === "number" && <Progress value={progress} className="h-1 mt-1.5" />}
              {sub && <p className="text-[10px] text-muted-foreground mt-1 truncate">{sub}</p>}
            </CardContent>
          </Card>
        </TooltipTrigger>
        {hint && <TooltipContent side="top" className="max-w-xs text-xs">{hint}</TooltipContent>}
      </Tooltip>
    </TooltipProvider>
  );
}

function NumCell({ value, onChange, onBlur }: { value: number; onChange: (v: number) => void; onBlur: () => void }) {
  return (
    <Input type="number" value={value} className="h-8 text-xs w-24"
      onChange={(e) => onChange(Number(e.target.value))} onBlur={onBlur} />
  );
}

function Row({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{k}</span>
      <span className={`font-mono ${accent ? "font-bold text-primary" : "font-medium"}`}>{v}</span>
    </div>
  );
}
