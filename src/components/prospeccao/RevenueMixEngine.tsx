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
    const reunioes = offers.reduce((s, o) => s + o.reunioes_agendadas, 0);
    const vendas = offers.reduce((s, o) => s + o.target_sales, 0);
    const metaPct = cfg.revenue_goal > 0 ? (receita / cfg.revenue_goal) * 100 : 0;
    const sdrs = cfg.sdr_capacity_per_day > 0 ? leads / (cfg.sdr_capacity_per_day * Math.max(cfg.cycle_days, 1)) : 0;
    const closers = cfg.closer_capacity_per_day > 0 ? reunioes / (cfg.closer_capacity_per_day * Math.max(cfg.cycle_days, 1)) : 0;
    // Dependência (% maior oferta)
    const maxReceita = Math.max(0, ...offers.map(o => o.receita));
    const dependencia = receita > 0 ? (maxReceita / receita) * 100 : 0;
    return { receita, margem, cac, lucro, leads, reunioes, vendas, metaPct, sdrs, closers, dependencia };
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
            <CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4 text-emerald-600" /> Capacidade do time</CardTitle>
            <CardDescription className="text-xs">Calculado pelo mix em {cfg.cycle_days} dias úteis.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
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
            <div className="p-3 rounded-lg border bg-card text-center">
              <p className="text-[10px] uppercase text-muted-foreground">SDRs</p>
              <p className="text-2xl font-bold text-emerald-600">{Math.ceil(totals.sdrs)}</p>
              <p className="text-[10px] text-muted-foreground">({totals.sdrs.toFixed(2)} ideal)</p>
            </div>
            <div className="p-3 rounded-lg border bg-card text-center">
              <p className="text-[10px] uppercase text-muted-foreground">Closers</p>
              <p className="text-2xl font-bold text-emerald-600">{Math.ceil(totals.closers)}</p>
              <p className="text-[10px] text-muted-foreground">({totals.closers.toFixed(2)} ideal)</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Plano de execução</CardTitle>
            <CardDescription className="text-xs">Atividades diárias para o mix bater a meta.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <Row k="Vendas totais (mês)" v={fmt(totals.vendas)} />
            <Row k="Reuniões agendadas" v={fmt(totals.reunioes)} />
            <Row k="Leads totais" v={fmt(totals.leads)} accent />
            <Row k="Prospecções/SDR/dia" v={`${cfg.sdr_capacity_per_day}`} />
            <Row k="Reuniões/Closer/dia" v={`${cfg.closer_capacity_per_day}`} />
            <div className="pt-2 mt-2 border-t flex items-center justify-between">
              <span className="text-muted-foreground">Pipeline alvo ({cfg.pipeline_coverage}x)</span>
              <span className="font-mono font-semibold">{money(totals.receita * cfg.pipeline_coverage)}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KPI({ icon: Icon, label, value, accent }: any) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 text-muted-foreground"><Icon className="h-3.5 w-3.5" /><span className="text-[10px] uppercase tracking-wide">{label}</span></div>
        <p className={`text-lg font-bold mt-1 ${accent || ""}`}>{value}</p>
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
