import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Target, DollarSign, TrendingUp, Users, AlertTriangle, Save, Layers, Sparkles, Briefcase, BadgePercent, Loader2, Activity, Gauge, Repeat, Zap, Calendar, PiggyBank, Scale, Phone, CalendarCheck, Trophy, Rocket } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useSalesMachineConfigs, useSaveSalesMachine, type SalesMachineConfig } from "@/hooks/useProspectingIntelligence";
import { useProdutosServicos, useRevenueOffers, useUpsertOffer, useDeleteOffer, computeOffer, type RevenueOffer } from "@/hooks/useRevenueEngine";
import { toast } from "sonner";

const fmt = (n: number) => new Intl.NumberFormat("pt-BR").format(Math.round(n));
const money = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n || 0);

const DEFAULT_CFG: SalesMachineConfig = {
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

export function RevenueMixEngine() {
  const { data: configs } = useSalesMachineConfigs();
  const saveCfg = useSaveSalesMachine();
  const [cfg, setCfg] = useState<SalesMachineConfig>(DEFAULT_CFG);

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
    // Dependência (% maior oferta)
    const maxReceita = Math.max(0, ...offers.map(o => o.receita));
    const dependencia = receita > 0 ? (maxReceita / receita) * 100 : 0;
    // Métricas avançadas
    const ticketMedioPond = vendas > 0 ? receita / vendas : 0;
    const margemPct = receita > 0 ? (margem / receita) * 100 : 0;
    const roi = cac > 0 ? (lucro / cac) * 100 : 0;
    // LTV simples = ticket médio * margem% (sem retenção configurável aqui — proxy 12 meses se recorrente)
    const ltvProxy = ticketMedioPond * (margemPct / 100);
    const ltvCac = vendas > 0 && cac > 0 ? ltvProxy / (cac / vendas) : 0;
    const cacUnit = vendas > 0 ? cac / vendas : 0;
    const paybackMeses = cacUnit > 0 && ticketMedioPond > 0 ? cacUnit / (ticketMedioPond * (margemPct / 100) || 1) : 0;
    const vendasDia = cfg.cycle_days > 0 ? vendas / cfg.cycle_days : 0;
    const leadsDia = cfg.cycle_days > 0 ? leads / cfg.cycle_days : 0;
    const reunioesDia = cfg.cycle_days > 0 ? reunioesAg / cfg.cycle_days : 0;
    const velocity = cfg.cycle_days > 0 ? receita / cfg.cycle_days : 0; // R$/dia
    const pipelineAlvo = receita * cfg.pipeline_coverage;
    const conversaoGlobal = leads > 0 ? (vendas / leads) * 100 : 0;
    const custoPorLead = leads > 0 ? cac / leads : 0;
    const custoPorReuniao = reunioesAg > 0 ? cac / reunioesAg : 0;
    // Capacidade vs disponibilidade
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
      {/* Header / Meta */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-transparent to-transparent">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Layers className="h-5 w-5 text-primary" /> Engenharia de Receita
                <Badge className="bg-gradient-to-r from-primary to-primary/70 text-primary-foreground gap-1">
                  <Sparkles className="h-3 w-3" /> Revenue Mix Engine
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                Modele a meta a partir do mix de ofertas. Cada oferta tem ticket, margem, conversões e CAC próprios.
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
            <Label className="text-xs">Meta de receita (mês)</Label>
            <Input className="h-9 mt-1" type="number" value={cfg.revenue_goal}
              onChange={(e) => setCfg({ ...cfg, revenue_goal: Number(e.target.value) })} />
          </div>
          <div>
            <Label className="text-xs">Ciclo (dias úteis)</Label>
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

      {/* KPIs do mix */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <KPI icon={Target} label="Receita projetada" value={money(totals.receita)} accent="text-emerald-600" />
        <KPI icon={BadgePercent} label="% da meta" value={`${totals.metaPct.toFixed(0)}%`} accent={totals.metaPct >= 100 ? "text-emerald-600" : "text-amber-600"} />
        <KPI icon={DollarSign} label="Margem bruta" value={money(totals.margem)} />
        <KPI icon={Briefcase} label="CAC total" value={money(totals.cac)} />
        <KPI icon={TrendingUp} label="Lucro líquido" value={money(totals.lucro)} accent={totals.lucro >= 0 ? "text-emerald-600" : "text-rose-600"} />
        <KPI icon={Users} label="Leads necessários" value={fmt(totals.leads)} accent="text-primary" />
      </div>

      {/* KPIs primários */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <KPI icon={Target} label="Receita projetada" value={money(totals.receita)} accent="text-emerald-600" sub={`Meta: ${money(cfg.revenue_goal)}`} />
        <KPI icon={BadgePercent} label="% da meta" value={`${totals.metaPct.toFixed(0)}%`} accent={totals.metaPct >= 100 ? "text-emerald-600" : "text-amber-600"} progress={Math.min(totals.metaPct, 100)} />
        <KPI icon={DollarSign} label="Margem bruta" value={money(totals.margem)} sub={`${totals.margemPct.toFixed(1)}% da receita`} />
        <KPI icon={Briefcase} label="CAC total" value={money(totals.cac)} sub={`Unit.: ${money(totals.cacUnit)}`} />
        <KPI icon={TrendingUp} label="Lucro líquido" value={money(totals.lucro)} accent={totals.lucro >= 0 ? "text-emerald-600" : "text-rose-600"} sub={`ROI ${totals.roi.toFixed(0)}%`} />
        <KPI icon={Users} label="Leads necessários" value={fmt(totals.leads)} accent="text-primary" sub={`${fmt(totals.leadsDia)}/dia`} />
      </div>

      {/* KPIs estratégicos */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <KPI icon={Scale} label="Ticket médio pond." value={money(totals.ticketMedioPond)} accent="text-indigo-600" />
        <KPI icon={PiggyBank} label="LTV / CAC" value={`${totals.ltvCac.toFixed(2)}x`} accent={totals.ltvCac >= 3 ? "text-emerald-600" : totals.ltvCac >= 1 ? "text-amber-600" : "text-rose-600"} sub={totals.ltvCac >= 3 ? "Saudável" : totals.ltvCac >= 1 ? "Ajustar" : "Crítico"} />
        <KPI icon={Repeat} label="Payback CAC" value={`${totals.paybackMeses.toFixed(1)} m`} accent={totals.paybackMeses <= 6 ? "text-emerald-600" : "text-amber-600"} />
        <KPI icon={Zap} label="Velocity" value={`${money(totals.velocity)}/dia`} accent="text-violet-600" />
        <KPI icon={Activity} label="Conv. global" value={`${totals.conversaoGlobal.toFixed(1)}%`} sub="Lead → Venda" />
        <KPI icon={Gauge} label="Pipeline alvo" value={money(totals.pipelineAlvo)} sub={`${cfg.pipeline_coverage}× cobertura`} />
      </div>

      {/* Alerta de dependência */}
      {totals.dependencia >= 70 && offers.length > 1 && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="p-3 flex items-center gap-2 text-xs">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span><strong>{totals.dependencia.toFixed(0)}%</strong> da meta depende de uma única oferta. Risco de concentração — diversifique o mix.</span>
          </CardContent>
        </Card>
      )}

      {/* Portfólio de ofertas */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-sm flex items-center gap-2"><Briefcase className="h-4 w-4" /> Portfólio de Ofertas</CardTitle>
              <CardDescription className="text-xs">Cada linha é uma oferta com funil próprio. A receita projetada vem da soma.</CardDescription>
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
                    <th className="py-2 px-1">Ticket</th>
                    <th className="py-2 px-1">Margem %</th>
                    <th className="py-2 px-1">Meta vendas</th>
                    <th className="py-2 px-1">Lead→Reun %</th>
                    <th className="py-2 px-1">Show %</th>
                    <th className="py-2 px-1">Win %</th>
                    <th className="py-2 px-1">CAC</th>
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

      {/* Capacidade & Plano de execução */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4 text-emerald-600" /> Capacidade & Utilização</CardTitle>
            <CardDescription className="text-xs">Mix em {cfg.cycle_days} dias úteis. Avalie se o time aguenta.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">SDR: leads/dia</Label>
                <Input className="h-8 mt-1" type="number" value={cfg.sdr_capacity_per_day}
                  onChange={(e) => setCfg({ ...cfg, sdr_capacity_per_day: Number(e.target.value) })} onBlur={handleSaveCfg} />
              </div>
              <div>
                <Label className="text-xs">Closer: reun./dia</Label>
                <Input className="h-8 mt-1" type="number" value={cfg.closer_capacity_per_day}
                  onChange={(e) => setCfg({ ...cfg, closer_capacity_per_day: Number(e.target.value) })} onBlur={handleSaveCfg} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg border bg-card">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase text-muted-foreground">SDRs necessários</p>
                  <Badge variant={totals.utilSdr > 100 ? "destructive" : totals.utilSdr > 80 ? "secondary" : "outline"} className="text-[9px] h-4">
                    {totals.utilSdr.toFixed(0)}% util.
                  </Badge>
                </div>
                <p className="text-2xl font-bold text-emerald-600">{Math.ceil(totals.sdrs)}</p>
                <Progress value={Math.min(totals.utilSdr, 100)} className="h-1.5 mt-1" />
                <p className="text-[10px] text-muted-foreground mt-1">{totals.sdrs.toFixed(2)} ideal</p>
              </div>
              <div className="p-3 rounded-lg border bg-card">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase text-muted-foreground">Closers necessários</p>
                  <Badge variant={totals.utilCloser > 100 ? "destructive" : totals.utilCloser > 80 ? "secondary" : "outline"} className="text-[9px] h-4">
                    {totals.utilCloser.toFixed(0)}% util.
                  </Badge>
                </div>
                <p className="text-2xl font-bold text-emerald-600">{Math.ceil(totals.closers)}</p>
                <Progress value={Math.min(totals.utilCloser, 100)} className="h-1.5 mt-1" />
                <p className="text-[10px] text-muted-foreground mt-1">{totals.closers.toFixed(2)} ideal</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-2 border-t">
              <Mini icon={Phone} label="Custo/lead" value={money(totals.custoPorLead)} />
              <Mini icon={CalendarCheck} label="Custo/reun." value={money(totals.custoPorReuniao)} />
              <Mini icon={Trophy} label="Custo/venda" value={money(totals.cacUnit)} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Rocket className="h-4 w-4 text-primary" /> Plano de execução diário</CardTitle>
            <CardDescription className="text-xs">Atividades para o mix bater a meta em {cfg.cycle_days} dias.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <Row k="Vendas totais (mês)" v={fmt(totals.vendas)} />
            <Row k="Vendas / dia útil" v={totals.vendasDia.toFixed(2)} accent />
            <Row k="Reuniões agendadas (mês)" v={fmt(totals.reunioesAg)} />
            <Row k="Reuniões realizadas (mês)" v={fmt(totals.reunioesReal)} />
            <Row k="Reuniões / dia" v={totals.reunioesDia.toFixed(1)} />
            <Row k="Leads totais (mês)" v={fmt(totals.leads)} accent />
            <Row k="Leads / dia" v={totals.leadsDia.toFixed(0)} />
            <div className="pt-2 mt-2 border-t space-y-1">
              <Row k="Velocity de receita" v={`${money(totals.velocity)}/dia`} />
              <Row k="Pipeline alvo" v={money(totals.pipelineAlvo)} />
              <Row k={`Cobertura (${cfg.pipeline_coverage}×)`} v={`${cfg.pipeline_coverage}x meta`} />
            </div>
          </CardContent>
        </Card>
      </div>

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

function KPI({ icon: Icon, label, value, accent, sub, progress }: any) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 text-muted-foreground"><Icon className="h-3.5 w-3.5" /><span className="text-[10px] uppercase tracking-wide">{label}</span></div>
        <p className={`text-lg font-bold mt-1 ${accent || ""}`}>{value}</p>
        {typeof progress === "number" && <Progress value={progress} className="h-1 mt-1.5" />}
        {sub && <p className="text-[10px] text-muted-foreground mt-1 truncate">{sub}</p>}
      </CardContent>
    </Card>
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
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{k}</span>
      <span className={`font-mono ${accent ? "font-bold text-primary" : "font-medium"}`}>{v}</span>
    </div>
  );
}
