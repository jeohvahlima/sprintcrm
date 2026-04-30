import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Stethoscope, Target, Rocket, LineChart as LineChartIcon, Save, AlertTriangle, CheckCircle2,
  TrendingUp, Phone, Mail, Users, Calendar, Briefcase, Loader2, ArrowRight,
  ArrowLeft, Trophy, Activity, Sparkles, Plus, Trash2, BarChart3, Medal, Crown, Award,
} from "lucide-react";
import { toast } from "sonner";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceDot,
} from "recharts";
import { RevenueMixEngine } from "./RevenueMixEngine";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import {
  useDiagnostico, DEFAULT_DIAGNOSTICO, type DiagnosticoMaquina, detectGargalos,
  useTodayLog, EMPTY_LOG, type DailyLog, useTeamLogs,
} from "@/hooks/useSalesMachineWizard";

const money = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n || 0);

const ATIVIDADES_LIST = [
  { key: "cold_call", label: "Cold Call (ligação fria)", icon: Phone },
  { key: "cold_email", label: "Cold E-mail", icon: Mail },
  { key: "social_selling", label: "Social Selling (LinkedIn/IG)", icon: Users },
  { key: "followup", label: "Follow-up sistemático", icon: Calendar },
  { key: "indicacao", label: "Indicação / Networking", icon: Sparkles },
  { key: "inbound", label: "Inbound (anúncios/site)", icon: Rocket },
  { key: "evento", label: "Eventos / Feiras", icon: Briefcase },
  { key: "whatsapp", label: "Prospecção via WhatsApp", icon: Phone },
];

const FERRAMENTAS_LIST = ["CRM", "Discador", "WhatsApp Business", "E-mail marketing", "LinkedIn Sales Navigator", "Planilhas"];

export function SalesMachineWizard() {
  const [phase, setPhase] = useState<"1" | "2" | "3" | "4">("1");
  const { data: diagDb, upsert } = useDiagnostico();
  const [diag, setDiag] = useState<DiagnosticoMaquina>(DEFAULT_DIAGNOSTICO);

  useEffect(() => {
    if (diagDb) setDiag(diagDb);
  }, [diagDb]);

  const gargalosAuto = useMemo(() => detectGargalos(diag), [diag]);

  const handleSaveDiag = async () => {
    try {
      await upsert.mutateAsync({ ...diag, gargalos_auto: gargalosAuto });
      toast.success("Diagnóstico salvo");
    } catch (e: any) {
      toast.error("Erro ao salvar", { description: e.message });
    }
  };

  const updDiag = (patch: Partial<DiagnosticoMaquina>) => setDiag(prev => ({ ...prev, ...patch }));
  const toggleAtv = (k: string) => updDiag({ atividades: { ...diag.atividades, [k]: !diag.atividades[k] } });
  const toggleFer = (f: string) => {
    const has = diag.ferramentas.includes(f);
    updDiag({ ferramentas: has ? diag.ferramentas.filter(x => x !== f) : [...diag.ferramentas, f] });
  };

  // Plano de ações dinâmico
  const addAction = () =>
    updDiag({ plano_acoes: [...diag.plano_acoes, { titulo: "", responsavel: "", prazo: "", status: "pendente" }] });
  const updAction = (i: number, patch: any) =>
    updDiag({ plano_acoes: diag.plano_acoes.map((a, idx) => (idx === i ? { ...a, ...patch } : a)) });
  const delAction = (i: number) => updDiag({ plano_acoes: diag.plano_acoes.filter((_, idx) => idx !== i) });

  // Cálculo de gap meta
  const gap = diag.meta_faturamento - diag.faturamento_atual;
  const gapPct = diag.faturamento_atual > 0 ? (gap / diag.faturamento_atual) * 100 : 0;

  // Sugestão de plano: se gap > 50%, recomenda contratar
  const sugestoes = useMemo(() => {
    const out: string[] = [];
    if (gapPct > 80) out.push(`Crescimento de ${Math.round(gapPct)}% é muito agressivo — considere expandir o time comercial.`);
    if (gapPct > 50 && diag.sdrs_atual < 2) out.push("Contratar pelo menos +1 SDR para gerar volume de oportunidades.");
    if (gapPct > 50 && diag.closers_atual < 2) out.push("Contratar +1 Closer para absorver as reuniões geradas.");
    if (diag.taxa_win_atual < 20) out.push("Treinar o time em fechamento — win rate atual está abaixo do saudável.");
    if (!diag.atividades?.followup) out.push("Implementar cadência de follow-up de 7 toques nos primeiros 30 dias.");
    if (diag.prazo_meses <= 3 && gapPct > 30) out.push("Prazo curto + meta agressiva: reforçar inbound pago para acelerar.");
    if (out.length === 0) out.push("Estrutura coerente com a meta — focar em execução e disciplina diária.");
    return out;
  }, [diag, gapPct]);

  return (
    <div className="space-y-4">
      {/* Progress bar das 4 fases */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> Construção da Máquina de Vendas
              </h3>
              <p className="text-xs text-muted-foreground">
                Diagnóstico → Meta & Prazo → Plano de Ação → Acompanhamento. Faça uma fase de cada vez.
              </p>
            </div>
            <Badge variant="outline">Fase {phase} de 4</Badge>
          </div>
          <Progress value={(parseInt(phase) / 4) * 100} className="h-2" />
        </CardContent>
      </Card>

      <Tabs value={phase} onValueChange={(v) => setPhase(v as any)}>
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="1" className="text-xs sm:text-sm gap-1.5">
            <Stethoscope className="h-4 w-4" /> 1. Diagnóstico
          </TabsTrigger>
          <TabsTrigger value="2" className="text-xs sm:text-sm gap-1.5">
            <Target className="h-4 w-4" /> 2. Meta & Prazo
          </TabsTrigger>
          <TabsTrigger value="3" className="text-xs sm:text-sm gap-1.5">
            <Rocket className="h-4 w-4" /> 3. Plano de Ação
          </TabsTrigger>
          <TabsTrigger value="4" className="text-xs sm:text-sm gap-1.5">
            <LineChartIcon className="h-4 w-4" /> 4. Acompanhamento
          </TabsTrigger>
        </TabsList>

        {/* ==================== FASE 1 — DIAGNÓSTICO ==================== */}
        <TabsContent value="1" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Stethoscope className="h-5 w-5 text-blue-600" /> Onde a empresa está hoje?
              </CardTitle>
              <CardDescription>
                Antes de definir para onde ir, precisamos entender o estado atual. Quanto tempo está travado nesse faturamento? Quais são as métricas e atividades que o time pratica hoje?
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Bloco financeiro */}
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-600" /> Financeiro atual
                </h4>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Faturamento mensal atual (R$)</Label>
                    <Input type="number" value={diag.faturamento_atual}
                      onChange={(e) => updDiag({ faturamento_atual: Number(e.target.value) })} />
                  </div>
                  <div>
                    <Label className="text-xs">Há quantos meses está travado nesse faturamento?</Label>
                    <Input type="number" value={diag.meses_travado}
                      onChange={(e) => updDiag({ meses_travado: Number(e.target.value) })} />
                  </div>
                </div>
              </div>

              {/* Estrutura comercial */}
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Users className="h-4 w-4 text-indigo-600" /> Estrutura comercial atual
                </h4>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Quantos SDRs / atendentes hoje?</Label>
                    <Input type="number" value={diag.sdrs_atual}
                      onChange={(e) => updDiag({ sdrs_atual: Number(e.target.value) })} />
                  </div>
                  <div>
                    <Label className="text-xs">Quantos Closers / vendedores hoje?</Label>
                    <Input type="number" value={diag.closers_atual}
                      onChange={(e) => updDiag({ closers_atual: Number(e.target.value) })} />
                  </div>
                </div>
                <div className="mt-3">
                  <Label className="text-xs mb-1.5 block">Ferramentas em uso</Label>
                  <div className="flex flex-wrap gap-2">
                    {FERRAMENTAS_LIST.map(f => {
                      const active = diag.ferramentas.includes(f);
                      return (
                        <Badge key={f} variant={active ? "default" : "outline"}
                          className="cursor-pointer" onClick={() => toggleFer(f)}>
                          {active ? "✓ " : "+ "}{f}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Métricas atuais */}
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-amber-600" /> Métricas atuais da esteira
                </h4>
                <p className="text-xs text-muted-foreground mb-3">Coloque os números que você consegue medir hoje. Use 0 se não tiver.</p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Ticket médio atual (R$)</Label>
                    <Input type="number" value={diag.ticket_medio_atual}
                      onChange={(e) => updDiag({ ticket_medio_atual: Number(e.target.value) })} />
                  </div>
                  <div>
                    <Label className="text-xs">Lead → Reunião (%)</Label>
                    <Input type="number" value={diag.taxa_lead_reuniao_atual}
                      onChange={(e) => updDiag({ taxa_lead_reuniao_atual: Number(e.target.value) })} />
                  </div>
                  <div>
                    <Label className="text-xs">Show-up nas reuniões (%)</Label>
                    <Input type="number" value={diag.taxa_show_atual}
                      onChange={(e) => updDiag({ taxa_show_atual: Number(e.target.value) })} />
                  </div>
                  <div>
                    <Label className="text-xs">Win rate / fechamento (%)</Label>
                    <Input type="number" value={diag.taxa_win_atual}
                      onChange={(e) => updDiag({ taxa_win_atual: Number(e.target.value) })} />
                  </div>
                  <div>
                    <Label className="text-xs">Ciclo médio de venda (dias)</Label>
                    <Input type="number" value={diag.ciclo_dias_atual}
                      onChange={(e) => updDiag({ ciclo_dias_atual: Number(e.target.value) })} />
                  </div>
                </div>
              </div>

              {/* Atividades praticadas */}
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Phone className="h-4 w-4 text-purple-600" /> Atividades comerciais que o time pratica hoje
                </h4>
                <div className="grid sm:grid-cols-2 gap-2">
                  {ATIVIDADES_LIST.map(({ key, label, icon: Icon }) => {
                    const active = !!diag.atividades[key];
                    return (
                      <button key={key} type="button" onClick={() => toggleAtv(key)}
                        className={`flex items-center gap-2 p-2.5 rounded-lg border text-left text-sm transition ${
                          active ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"
                        }`}>
                        <Icon className={`h-4 w-4 ${active ? "text-primary" : "text-muted-foreground"}`} />
                        <span className="flex-1">{label}</span>
                        {active && <CheckCircle2 className="h-4 w-4 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Gargalos */}
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" /> Gargalos identificados
                </h4>
                {gargalosAuto.length > 0 && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 mb-3 space-y-1.5">
                    <p className="text-xs font-semibold text-red-700 dark:text-red-400">Detectado automaticamente:</p>
                    {gargalosAuto.map((g, i) => (
                      <div key={i} className="text-xs flex items-start gap-1.5">
                        <span className="text-red-600 mt-0.5">•</span>
                        <span>{g}</span>
                      </div>
                    ))}
                  </div>
                )}
                <Label className="text-xs">Observações adicionais sobre gargalos / dificuldades</Label>
                <Textarea rows={3} value={diag.gargalos_observacoes || ""}
                  onChange={(e) => updDiag({ gargalos_observacoes: e.target.value })}
                  placeholder="Ex: time não tem script, ICP definido só no papel, vendedor faz o trabalho de SDR..." />
              </div>

              <div className="flex items-center justify-between pt-2 border-t">
                <Button variant="outline" disabled>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Anterior
                </Button>
                <div className="flex gap-2">
                  <Button onClick={handleSaveDiag} disabled={upsert.isPending} variant="outline">
                    {upsert.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                    Salvar diagnóstico
                  </Button>
                  <Button onClick={() => { handleSaveDiag(); setPhase("2"); }}>
                    Próxima fase: Meta & Prazo <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== FASE 2 — META & PRAZO ==================== */}
        <TabsContent value="2" className="space-y-4 mt-4">
          <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-transparent">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="h-5 w-5 text-emerald-600" /> Para onde a empresa quer ir?
              </CardTitle>
              <CardDescription>
                Defina a meta de faturamento, em quanto tempo quer atingir e se vai manter ou expandir a estrutura comercial.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Faturamento atual (R$)</Label>
                  <Input type="number" value={diag.faturamento_atual} disabled />
                  <p className="text-[10px] text-muted-foreground mt-0.5">Vem da Fase 1</p>
                </div>
                <div>
                  <Label className="text-xs">Meta de faturamento mensal (R$) *</Label>
                  <Input type="number" value={diag.meta_faturamento}
                    onChange={(e) => updDiag({ meta_faturamento: Number(e.target.value) })} />
                </div>
                <div>
                  <Label className="text-xs">Em quantos meses quer atingir? *</Label>
                  <Input type="number" value={diag.prazo_meses}
                    onChange={(e) => updDiag({ prazo_meses: Number(e.target.value) })} />
                </div>
              </div>

              {/* Visão do GAP */}
              {diag.meta_faturamento > 0 && diag.faturamento_atual > 0 && (
                <div className="grid sm:grid-cols-3 gap-3">
                  <Card className="bg-muted/40">
                    <CardContent className="p-3">
                      <p className="text-[11px] uppercase text-muted-foreground tracking-wide">GAP a fechar</p>
                      <p className="text-2xl font-bold text-emerald-600">{money(gap)}</p>
                      <p className="text-[11px] text-muted-foreground">por mês</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted/40">
                    <CardContent className="p-3">
                      <p className="text-[11px] uppercase text-muted-foreground tracking-wide">Crescimento</p>
                      <p className="text-2xl font-bold text-blue-600">{Math.round(gapPct)}%</p>
                      <p className="text-[11px] text-muted-foreground">sobre o atual</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted/40">
                    <CardContent className="p-3">
                      <p className="text-[11px] uppercase text-muted-foreground tracking-wide">Crescimento mensal médio</p>
                      <p className="text-2xl font-bold text-purple-600">
                        {diag.prazo_meses > 0 ? Math.round(gapPct / diag.prazo_meses) : 0}%
                      </p>
                      <p className="text-[11px] text-muted-foreground">ao mês</p>
                    </CardContent>
                  </Card>
                </div>
              )}

              <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                <Switch checked={diag.manter_estrutura}
                  onCheckedChange={(v) => updDiag({ manter_estrutura: v })} />
                <div className="flex-1">
                  <p className="text-sm font-medium">Manter a mesma estrutura comercial atual?</p>
                  <p className="text-xs text-muted-foreground">
                    {diag.manter_estrutura
                      ? `Operação fica com ${diag.sdrs_atual} SDR(s) e ${diag.closers_atual} Closer(s).`
                      : "Você poderá redimensionar o time na Fase 3."}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t">
                <Button variant="outline" onClick={() => setPhase("1")}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
                </Button>
                <Button onClick={() => { handleSaveDiag(); setPhase("3"); }}>
                  Próxima fase: Plano de Ação <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== FASE 3 — PLANO DE AÇÃO ==================== */}
        <TabsContent value="3" className="space-y-4 mt-4">
          <Card className="border-orange-500/30 bg-gradient-to-br from-orange-500/5 to-transparent">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Rocket className="h-5 w-5 text-orange-600" /> Como vamos chegar lá?
              </CardTitle>
              <CardDescription>
                Use o motor de receita abaixo para dimensionar leads, reuniões, vendas e capacidade do time. Depois, registre as ações concretas.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Sugestões automáticas */}
              <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-3">
                <p className="text-xs font-semibold text-orange-700 dark:text-orange-400 mb-2 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> Recomendações com base no diagnóstico
                </p>
                <ul className="space-y-1">
                  {sugestoes.map((s, i) => (
                    <li key={i} className="text-xs flex items-start gap-1.5">
                      <span className="text-orange-600 mt-0.5">→</span><span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Lista de ações editáveis */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold">Plano de ações concretas</h4>
                  <Button size="sm" variant="outline" onClick={addAction}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar ação
                  </Button>
                </div>
                {diag.plano_acoes.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">
                    Nenhuma ação cadastrada. Adicione tarefas como "Contratar 1 SDR", "Implementar cadência de follow-up", etc.
                  </p>
                )}
                <div className="space-y-2">
                  {diag.plano_acoes.map((a, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center p-2 rounded border">
                      <Input className="col-span-5" placeholder="O quê?" value={a.titulo}
                        onChange={(e) => updAction(i, { titulo: e.target.value })} />
                      <Input className="col-span-3" placeholder="Responsável" value={a.responsavel || ""}
                        onChange={(e) => updAction(i, { responsavel: e.target.value })} />
                      <Input className="col-span-3" type="date" value={a.prazo || ""}
                        onChange={(e) => updAction(i, { prazo: e.target.value })} />
                      <Button size="icon" variant="ghost" className="col-span-1" onClick={() => delAction(i)}>
                        <Trash2 className="h-3.5 w-3.5 text-red-600" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Motor de receita (Fase 2 antiga) */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Target className="h-4 w-4 text-blue-600" /> Engenharia de Receita
                </h4>
                <p className="text-xs text-muted-foreground mb-3">
                  Configure ofertas, taxas de conversão e capacidade do time. O sistema calcula leads, reuniões e vendas necessárias por dia/semana/mês.
                </p>
                <div className="rounded-lg border bg-background p-3">
                  <RevenueMixEngine />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t">
                <Button variant="outline" onClick={() => setPhase("2")}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
                </Button>
                <Button onClick={() => { handleSaveDiag(); setPhase("4"); }}>
                  Próxima fase: Acompanhamento <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== FASE 4 — ACOMPANHAMENTO ==================== */}
        <TabsContent value="4" className="space-y-4 mt-4">
          <AccompanyPanel meta={diag.meta_faturamento} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ==================== Painel de Acompanhamento ====================
function AccompanyPanel({ meta }: { meta: number }) {
  const { data: todayLog, save } = useTodayLog();
  const { data: teamLogs } = useTeamLogs(90);
  const { members } = useTeamMembers();
  const [log, setLog] = useState<DailyLog>(EMPTY_LOG);
  const [periodView, setPeriodView] = useState<"dia" | "semana" | "mes" | "trimestre">("semana");
  const [dataEspecifica, setDataEspecifica] = useState<string>("");

  useEffect(() => {
    if (todayLog) setLog(todayLog);
  }, [todayLog]);

  const upd = (patch: Partial<DailyLog>) => setLog(prev => ({ ...prev, ...patch }));

  const handleSave = async () => {
    try {
      await save.mutateAsync(log);
      toast.success("Check-in do dia salvo!");
    } catch (e: any) {
      toast.error("Erro ao salvar", { description: e.message });
    }
  };

  const memberName = (uid?: string) => {
    if (!uid) return "Sem usuário";
    const m = members.find(x => x.id === uid);
    return m?.full_name || m?.email || `Usuário ${uid.slice(0, 6)}`;
  };

  // Filtro por período OU data específica
  const logsFiltrados = useMemo(() => {
    const logs = teamLogs || [];
    if (dataEspecifica) {
      return logs.filter(l => l.log_date === dataEspecifica);
    }
    const now = new Date();
    const filterDays = periodView === "dia" ? 1 : periodView === "semana" ? 7 : periodView === "mes" ? 30 : 90;
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - filterDays);
    return logs.filter(l => new Date(l.log_date) >= cutoff);
  }, [teamLogs, periodView, dataEspecifica]);

  // Agrega o time
  const agg = useMemo(() => {
    return logsFiltrados.reduce(
      (acc, l) => ({
        leads: acc.leads + (l.leads_prospectados || 0),
        ligacoes: acc.ligacoes + (l.ligacoes_feitas || 0),
        reunioesAg: acc.reunioesAg + (l.reunioes_agendadas || 0),
        reunioesReal: acc.reunioesReal + (l.reunioes_realizadas || 0),
        oportunidades: acc.oportunidades + (l.oportunidades_abertas || 0),
        propostas: acc.propostas + (l.propostas_enviadas || 0),
        vendas: acc.vendas + (l.vendas_fechadas || 0),
        faturamento: acc.faturamento + Number(l.faturamento_gerado || 0),
      }),
      { leads: 0, ligacoes: 0, reunioesAg: 0, reunioesReal: 0, oportunidades: 0, propostas: 0, vendas: 0, faturamento: 0 }
    );
  }, [logsFiltrados]);

  // Série temporal por dia (faturamento + vendas) — sempre últimos 30 dias para o gráfico
  const serieDiaria = useMemo(() => {
    const logs = teamLogs || [];
    const now = new Date();
    const dias = 30;
    const map = new Map<string, { faturamento: number; vendas: number; leads: number }>();
    for (let i = dias - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      map.set(key, { faturamento: 0, vendas: 0, leads: 0 });
    }
    logs.forEach(l => {
      const cur = map.get(l.log_date);
      if (cur) {
        cur.faturamento += Number(l.faturamento_gerado || 0);
        cur.vendas += l.vendas_fechadas || 0;
        cur.leads += l.leads_prospectados || 0;
      }
    });
    return Array.from(map.entries()).map(([date, v]) => ({
      date,
      label: new Date(date + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      ...v,
    }));
  }, [teamLogs]);

  const picoFaturamento = useMemo(() => {
    if (!serieDiaria.length) return null;
    return serieDiaria.reduce((max, d) => (d.faturamento > max.faturamento ? d : max), serieDiaria[0]);
  }, [serieDiaria]);

  // Ranking por usuário (com base no período/data filtrado)
  const ranking = useMemo(() => {
    const map = new Map<string, {
      user_id: string; role: string;
      leads: number; ligacoes: number; reunioes: number; vendas: number; faturamento: number;
    }>();
    logsFiltrados.forEach(l => {
      const uid = (l as any).user_id || "—";
      const cur = map.get(uid) || {
        user_id: uid, role: l.role_type,
        leads: 0, ligacoes: 0, reunioes: 0, vendas: 0, faturamento: 0,
      };
      cur.leads += l.leads_prospectados || 0;
      cur.ligacoes += l.ligacoes_feitas || 0;
      cur.reunioes += l.reunioes_realizadas || 0;
      cur.vendas += l.vendas_fechadas || 0;
      cur.faturamento += Number(l.faturamento_gerado || 0);
      cur.role = l.role_type;
      map.set(uid, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.faturamento - a.faturamento);
  }, [logsFiltrados]);

  const topSDR = useMemo(
    () => [...ranking].filter(r => r.role === "sdr" || r.role === "hibrido")
      .sort((a, b) => (b.reunioes - a.reunioes) || (b.leads - a.leads))[0],
    [ranking]
  );
  const topCloser = useMemo(
    () => [...ranking].filter(r => r.role === "closer" || r.role === "hibrido")
      .sort((a, b) => b.faturamento - a.faturamento)[0],
    [ranking]
  );

  const metaPeriodo = useMemo(() => {
    if (!meta) return 0;
    if (dataEspecifica || periodView === "dia") return meta / 22;
    if (periodView === "semana") return meta / 4.33;
    if (periodView === "mes") return meta;
    return meta * 3;
  }, [meta, periodView, dataEspecifica]);

  const progressoMeta = metaPeriodo > 0 ? (agg.faturamento / metaPeriodo) * 100 : 0;

  return (
    <>
      {/* Check-in do dia */}
      <Card className="border-blue-500/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-5 w-5 text-blue-600" /> Check-in de hoje
            <Badge variant="outline" className="text-[10px]">{new Date().toLocaleDateString("pt-BR")}</Badge>
          </CardTitle>
          <CardDescription>
            Cada SDR/Closer registra suas atividades do dia. Leva 30 segundos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">Meu papel hoje</Label>
            <div className="flex gap-2 mt-1">
              {(["sdr", "closer", "hibrido"] as const).map(r => (
                <Badge key={r} variant={log.role_type === r ? "default" : "outline"}
                  className="cursor-pointer capitalize" onClick={() => upd({ role_type: r })}>
                  {r === "hibrido" ? "Híbrido" : r.toUpperCase()}
                </Badge>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <NumField label="Leads prospectados" v={log.leads_prospectados} on={(n) => upd({ leads_prospectados: n })} />
            <NumField label="Ligações feitas" v={log.ligacoes_feitas} on={(n) => upd({ ligacoes_feitas: n })} />
            <NumField label="Mensagens enviadas" v={log.mensagens_enviadas} on={(n) => upd({ mensagens_enviadas: n })} />
            <NumField label="Follow-ups" v={log.followups} on={(n) => upd({ followups: n })} />
            <NumField label="Reuniões agendadas" v={log.reunioes_agendadas} on={(n) => upd({ reunioes_agendadas: n })} />
            <NumField label="Reuniões realizadas" v={log.reunioes_realizadas} on={(n) => upd({ reunioes_realizadas: n })} />
            <NumField label="Oportunidades" v={log.oportunidades_abertas} on={(n) => upd({ oportunidades_abertas: n })} />
            <NumField label="Propostas enviadas" v={log.propostas_enviadas} on={(n) => upd({ propostas_enviadas: n })} />
            <NumField label="Vendas fechadas" v={log.vendas_fechadas} on={(n) => upd({ vendas_fechadas: n })} />
            <div className="col-span-2 sm:col-span-3">
              <Label className="text-xs">Faturamento gerado hoje (R$)</Label>
              <Input type="number" value={log.faturamento_gerado}
                onChange={(e) => upd({ faturamento_gerado: Number(e.target.value) })} />
            </div>
          </div>

          <div>
            <Label className="text-xs">Observações do dia</Label>
            <Textarea rows={2} value={log.observacoes || ""}
              onChange={(e) => upd({ observacoes: e.target.value })}
              placeholder="Vitórias, perdas, aprendizados, bloqueios..." />
          </div>

          <Button onClick={handleSave} disabled={save.isPending} className="w-full">
            {save.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            Salvar check-in de hoje
          </Button>
        </CardContent>
      </Card>

      {/* Painel agregado do time */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Trophy className="h-5 w-5 text-amber-600" /> Desempenho do time
              </CardTitle>
              <CardDescription>
                {dataEspecifica
                  ? `Visualizando o dia ${new Date(dataEspecifica + "T00:00:00").toLocaleDateString("pt-BR")}`
                  : "Soma de todos os check-ins no período selecionado."}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1">
                <Label className="text-[10px] uppercase text-muted-foreground">Data:</Label>
                <Input
                  type="date"
                  value={dataEspecifica}
                  onChange={(e) => setDataEspecifica(e.target.value)}
                  className="h-7 w-[140px] text-xs"
                />
                {dataEspecifica && (
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]"
                    onClick={() => setDataEspecifica("")}>limpar</Button>
                )}
              </div>
              {!dataEspecifica && (
                <div className="flex gap-1">
                  {(["dia", "semana", "mes", "trimestre"] as const).map(p => (
                    <Badge key={p} variant={periodView === p ? "default" : "outline"}
                      className="cursor-pointer capitalize" onClick={() => setPeriodView(p)}>{p}</Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Faturamento vs meta */}
          {meta > 0 && (
            <div className="rounded-lg border p-3 bg-gradient-to-r from-emerald-500/5 to-blue-500/5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold uppercase text-muted-foreground">
                  Faturamento {dataEspecifica ? "do dia" : periodView}
                </span>
                <span className="text-xs">{progressoMeta.toFixed(1)}% da meta</span>
              </div>
              <div className="flex items-end gap-3 mb-2">
                <span className="text-2xl font-bold text-emerald-600">{money(agg.faturamento)}</span>
                <span className="text-sm text-muted-foreground mb-1">/ {money(metaPeriodo)}</span>
              </div>
              <Progress value={Math.min(progressoMeta, 100)} className="h-2" />
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KPI label="Leads" value={agg.leads} />
            <KPI label="Ligações" value={agg.ligacoes} />
            <KPI label="Reuniões agend." value={agg.reunioesAg} />
            <KPI label="Reuniões real." value={agg.reunioesReal} />
            <KPI label="Oportunidades" value={agg.oportunidades} />
            <KPI label="Propostas" value={agg.propostas} />
            <KPI label="Vendas" value={agg.vendas} highlight />
            <KPI label="Conversão" value={agg.leads > 0 ? `${((agg.vendas / agg.leads) * 100).toFixed(1)}%` : "—"} />
          </div>

          {/* Gráfico de evolução com picos */}
          <div className="rounded-lg border p-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
                <BarChart3 className="h-3.5 w-3.5" /> Evolução diária — últimos 30 dias
              </h4>
              {picoFaturamento && picoFaturamento.faturamento > 0 && (
                <Badge variant="outline" className="text-[10px] gap-1">
                  <TrendingUp className="h-3 w-3 text-emerald-600" />
                  Pico: {picoFaturamento.label} — {money(picoFaturamento.faturamento)}
                </Badge>
              )}
            </div>
            {serieDiaria.every(d => d.faturamento === 0 && d.vendas === 0) ? (
              <p className="text-xs text-muted-foreground italic py-8 text-center">
                Sem check-ins nos últimos 30 dias. Registre o primeiro acima para ver picos e tendências.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={serieDiaria} onClick={(e: any) => {
                  if (e?.activePayload?.[0]?.payload?.date) setDataEspecifica(e.activePayload[0].payload.date);
                }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                  <YAxis yAxisId="left" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: any, name: string) => name === "Faturamento" ? money(Number(v)) : v}
                  />
                  <Line yAxisId="left" type="monotone" dataKey="faturamento" name="Faturamento"
                    stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  <Line yAxisId="right" type="monotone" dataKey="vendas" name="Vendas"
                    stroke="#10b981" strokeWidth={2} dot={{ r: 2 }} />
                  <Line yAxisId="right" type="monotone" dataKey="leads" name="Leads"
                    stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
                  {picoFaturamento && picoFaturamento.faturamento > 0 && (
                    <ReferenceDot yAxisId="left" x={picoFaturamento.label} y={picoFaturamento.faturamento}
                      r={6} fill="#10b981" stroke="#fff" strokeWidth={2} />
                  )}
                </LineChart>
              </ResponsiveContainer>
            )}
            <p className="text-[10px] text-muted-foreground mt-1 italic">
              💡 Clique em um ponto no gráfico para filtrar os dados daquele dia.
            </p>
          </div>

          {/* Top performers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-lg border p-3 bg-gradient-to-br from-amber-500/5 to-orange-500/5">
              <div className="flex items-center gap-2 mb-2">
                <Crown className="h-4 w-4 text-amber-600" />
                <h4 className="text-xs font-semibold uppercase">Top SDR</h4>
              </div>
              {topSDR ? (
                <>
                  <p className="font-bold text-sm">{memberName(topSDR.user_id)}</p>
                  <div className="flex gap-3 mt-1 text-[11px] text-muted-foreground">
                    <span>{topSDR.leads} leads</span>
                    <span>{topSDR.reunioes} reuniões</span>
                    <span>{topSDR.ligacoes} ligações</span>
                  </div>
                </>
              ) : <p className="text-xs text-muted-foreground italic">Sem dados de SDR no período.</p>}
            </div>
            <div className="rounded-lg border p-3 bg-gradient-to-br from-emerald-500/5 to-blue-500/5">
              <div className="flex items-center gap-2 mb-2">
                <Award className="h-4 w-4 text-emerald-600" />
                <h4 className="text-xs font-semibold uppercase">Top Vendedor (Closer)</h4>
              </div>
              {topCloser ? (
                <>
                  <p className="font-bold text-sm">{memberName(topCloser.user_id)}</p>
                  <div className="flex gap-3 mt-1 text-[11px]">
                    <span className="text-emerald-700 font-semibold">{money(topCloser.faturamento)}</span>
                    <span className="text-muted-foreground">{topCloser.vendas} vendas</span>
                  </div>
                </>
              ) : <p className="text-xs text-muted-foreground italic">Sem dados de closer no período.</p>}
            </div>
          </div>

          {/* Ranking completo */}
          <div>
            <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-1.5">
              <Medal className="h-3.5 w-3.5" /> Ranking de performance
            </h4>
            <div className="rounded border overflow-hidden">
              <div className="grid grid-cols-12 px-3 py-1.5 bg-muted/40 text-[10px] uppercase font-semibold tracking-wide">
                <div className="col-span-1">#</div>
                <div className="col-span-4">Vendedor</div>
                <div className="col-span-1 text-center">Papel</div>
                <div className="col-span-1 text-right">Leads</div>
                <div className="col-span-1 text-right">Ligações</div>
                <div className="col-span-1 text-right">Reuniões</div>
                <div className="col-span-1 text-right">Vendas</div>
                <div className="col-span-2 text-right">Faturamento</div>
              </div>
              {ranking.length === 0 && (
                <p className="text-xs text-muted-foreground p-3 italic">Nenhum check-in no período selecionado.</p>
              )}
              {ranking.map((r, i) => (
                <div key={r.user_id} className="grid grid-cols-12 px-3 py-2 border-t text-xs items-center hover:bg-muted/30">
                  <div className="col-span-1 font-bold">
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}º`}
                  </div>
                  <div className="col-span-4 truncate font-medium">{memberName(r.user_id)}</div>
                  <div className="col-span-1 text-center">
                    <Badge variant="outline" className="text-[9px] uppercase">{r.role}</Badge>
                  </div>
                  <div className="col-span-1 text-right">{r.leads}</div>
                  <div className="col-span-1 text-right">{r.ligacoes}</div>
                  <div className="col-span-1 text-right">{r.reunioes}</div>
                  <div className="col-span-1 text-right font-semibold">{r.vendas}</div>
                  <div className="col-span-2 text-right text-emerald-700 font-bold">{money(r.faturamento)}</div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function NumField({ label, v, on }: { label: string; v: number; on: (n: number) => void }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input type="number" value={v} onChange={(e) => on(Number(e.target.value))} />
    </div>
  );
}

function KPI({ label, value, highlight }: { label: string; value: number | string; highlight?: boolean }) {
  return (
    <div className="rounded-lg border p-3 bg-muted/30">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold mt-0.5 ${highlight ? "text-emerald-600" : ""}`}>{value}</p>
    </div>
  );
}
