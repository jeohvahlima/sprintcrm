import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import {
  Scale, Gavel, Clock, DollarSign, TrendingUp, AlertTriangle,
  Users, Activity, Target, Calendar, Pause, FileWarning, Trophy, Building2,
} from "lucide-react";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import JuridicoKanban from "./JuridicoKanban";
import { format, addDays, differenceInDays, subMonths, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_LABELS: Record<string, string> = {
  pre_processual: "Pré-Processual",
  protocolado: "Protocolado",
  em_andamento: "Em Andamento",
  aguardando_citacao: "Ag. Citação",
  aguardando_contestacao: "Ag. Contestação",
  aguardando_audiencia: "Ag. Audiência",
  aguardando_pericia: "Ag. Perícia",
  aguardando_sentenca: "Ag. Sentença",
  em_recurso: "Em Recurso",
  em_execucao: "Em Execução",
  cumprimento_sentenca: "Cumprimento de Sentença",
  acordo: "Acordo",
  transito_julgado: "Trânsito em Julgado",
  suspenso: "Suspenso",
  arquivado: "Arquivado",
  extinto: "Extinto",
  ganho: "Ganho",
  perdido: "Perdido",
};

const TIPO_LABELS: Record<string, string> = {
  civil: "Civil",
  trabalhista: "Trabalhista",
  criminal: "Criminal",
  tributario: "Tributário",
  administrativo: "Administrativo",
  comercial: "Comercial / Empresarial",
  previdenciario: "Previdenciário",
  familia: "Família e Sucessões",
  consumidor: "Direito do Consumidor",
  imobiliario: "Imobiliário",
  contratual: "Contratual",
  bancario: "Bancário / Financeiro",
  ambiental: "Ambiental",
  eleitoral: "Eleitoral",
  juizado_especial: "Juizado Especial (JEC)",
  execucao_fiscal: "Execução Fiscal",
  recuperacao_judicial: "Recuperação Judicial / Falência",
  arbitragem: "Arbitragem",
  regulatorio: "Regulatório / Concorrencial",
  internacional: "Internacional",
  militar: "Militar",
  outro: "Outro",
};

const STATUS_FINALIZADOS = ["ganho", "perdido", "arquivado", "extinto", "transito_julgado"];

interface Process {
  id: string;
  numero_processo: string | null;
  tipo: string;
  status: string;
  parte_contraria: string | null;
  vara: string | null;
  comarca: string | null;
  valor_causa: number | null;
  valor_honorarios: number | null;
  data_distribuicao: string | null;
  data_audiencia: string | null;
  prioridade: string | null;
  responsavel_id: string | null;
  created_at: string;
  updated_at: string;
}

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: v >= 1_000_000 ? "compact" : "standard" }).format(v);

export default function JuridicoAnalytics({ userCompanyId }: { userCompanyId: string | null }) {
  const [processes, setProcesses] = useState<Process[]>([]);
  const [responsaveis, setResponsaveis] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [periodFilter, setPeriodFilter] = useState<"all" | "30" | "90" | "180" | "365">("all");
  const [tipoFilter, setTipoFilter] = useState<string>("all");
  const [responsavelFilter, setResponsavelFilter] = useState<string>("all");

  useEffect(() => {
    if (!userCompanyId) return;
    fetchData();
  }, [userCompanyId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: procs } = await supabase
        .from("legal_processes")
        .select("*")
        .eq("company_id", userCompanyId!)
        .range(0, 4999);

      setProcesses((procs || []) as Process[]);

      // Busca nomes dos responsáveis
      const ids = Array.from(new Set((procs || []).map((p: any) => p.responsavel_id).filter(Boolean)));
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", ids);
        const map: Record<string, string> = {};
        (profs || []).forEach((p: any) => { map[p.id] = p.full_name || "Sem nome"; });
        setResponsaveis(map);
      }
    } finally {
      setLoading(false);
    }
  };

  // ───── Filtros ─────
  const filtered = useMemo(() => {
    let list = processes;
    if (periodFilter !== "all") {
      const days = parseInt(periodFilter);
      const cutoff = addDays(new Date(), -days);
      list = list.filter(p => new Date(p.created_at) >= cutoff);
    }
    if (tipoFilter !== "all") list = list.filter(p => p.tipo === tipoFilter);
    if (responsavelFilter !== "all") list = list.filter(p => p.responsavel_id === responsavelFilter);
    return list;
  }, [processes, periodFilter, tipoFilter, responsavelFilter]);

  // ───── Métricas ─────
  const stats = useMemo(() => {
    const now = new Date();
    const ativos = filtered.filter(p => !STATUS_FINALIZADOS.includes(p.status));
    const ganhos = filtered.filter(p => p.status === "ganho").length;
    const perdidos = filtered.filter(p => p.status === "perdido").length;
    const acordos = filtered.filter(p => p.status === "acordo").length;
    const valorCausa = filtered.reduce((s, p) => s + (Number(p.valor_causa) || 0), 0);
    const valorHonorarios = filtered.reduce((s, p) => s + (Number(p.valor_honorarios) || 0), 0);
    const ticketMedio = filtered.length ? valorCausa / filtered.length : 0;
    const taxaExito = ganhos + perdidos > 0 ? (ganhos / (ganhos + perdidos)) * 100 : 0;
    const taxaConciliacao = filtered.length ? (acordos / filtered.length) * 100 : 0;

    // Tempo médio de tramitação (finalizados)
    const finalizados = filtered.filter(p => STATUS_FINALIZADOS.includes(p.status) && p.data_distribuicao);
    const tempoMedio = finalizados.length
      ? Math.round(finalizados.reduce((s, p) => s + differenceInDays(new Date(p.updated_at), new Date(p.data_distribuicao!)), 0) / finalizados.length)
      : 0;

    // Processos parados (sem updated_at recente)
    const parados30 = ativos.filter(p => differenceInDays(now, new Date(p.updated_at)) >= 30);
    const parados60 = ativos.filter(p => differenceInDays(now, new Date(p.updated_at)) >= 60);
    const parados90 = ativos.filter(p => differenceInDays(now, new Date(p.updated_at)) >= 90);

    // Audiências próximas
    const aud7 = filtered.filter(p => p.data_audiencia && new Date(p.data_audiencia) >= now && new Date(p.data_audiencia) <= addDays(now, 7));
    const aud15 = filtered.filter(p => p.data_audiencia && new Date(p.data_audiencia) >= now && new Date(p.data_audiencia) <= addDays(now, 15));
    const aud30 = filtered.filter(p => p.data_audiencia && new Date(p.data_audiencia) >= now && new Date(p.data_audiencia) <= addDays(now, 30));

    // Por tipo
    const tipoMap: Record<string, number> = {};
    filtered.forEach(p => { tipoMap[p.tipo] = (tipoMap[p.tipo] || 0) + 1; });
    const porTipo = Object.entries(tipoMap).map(([tipo, count]) => ({ tipo, count })).sort((a, b) => b.count - a.count);

    // Por status
    const statusMap: Record<string, number> = {};
    filtered.forEach(p => { statusMap[p.status] = (statusMap[p.status] || 0) + 1; });

    // Top partes contrárias
    const parteMap: Record<string, number> = {};
    filtered.forEach(p => { if (p.parte_contraria) parteMap[p.parte_contraria] = (parteMap[p.parte_contraria] || 0) + 1; });
    const topPartes = Object.entries(parteMap).sort((a, b) => b[1] - a[1]).slice(0, 10);

    // Por comarca
    const comarcaMap: Record<string, number> = {};
    filtered.forEach(p => { if (p.comarca) comarcaMap[p.comarca] = (comarcaMap[p.comarca] || 0) + 1; });
    const topComarcas = Object.entries(comarcaMap).sort((a, b) => b[1] - a[1]).slice(0, 8);

    // Por responsável
    const respMap: Record<string, { total: number; ativos: number; ganhos: number; valor: number }> = {};
    filtered.forEach(p => {
      const rid = p.responsavel_id || "sem_responsavel";
      if (!respMap[rid]) respMap[rid] = { total: 0, ativos: 0, ganhos: 0, valor: 0 };
      respMap[rid].total += 1;
      if (!STATUS_FINALIZADOS.includes(p.status)) respMap[rid].ativos += 1;
      if (p.status === "ganho") respMap[rid].ganhos += 1;
      respMap[rid].valor += Number(p.valor_causa) || 0;
    });
    const porResponsavel = Object.entries(respMap)
      .map(([id, d]) => ({ id, nome: id === "sem_responsavel" ? "Sem responsável" : (responsaveis[id] || "Desconhecido"), ...d }))
      .sort((a, b) => b.total - a.total);

    // Evolução temporal (últimos 6 meses): novos vs finalizados
    const meses: { mes: string; novos: number; finalizados: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const ref = startOfMonth(subMonths(new Date(), i));
      const next = startOfMonth(subMonths(new Date(), i - 1));
      const novos = filtered.filter(p => new Date(p.created_at) >= ref && new Date(p.created_at) < next).length;
      const fin = filtered.filter(p => STATUS_FINALIZADOS.includes(p.status) && new Date(p.updated_at) >= ref && new Date(p.updated_at) < next).length;
      meses.push({ mes: format(ref, "MMM/yy", { locale: ptBR }), novos, finalizados: fin });
    }

    // Alertas
    const alertas: { tipo: "critico" | "alerta" | "info"; titulo: string; processo: Process }[] = [];
    filtered.forEach(p => {
      if (!STATUS_FINALIZADOS.includes(p.status)) {
        const diasParado = differenceInDays(now, new Date(p.updated_at));
        if (diasParado >= 90) alertas.push({ tipo: "critico", titulo: `Parado há ${diasParado} dias`, processo: p });
        if (p.data_audiencia && new Date(p.data_audiencia) >= now && new Date(p.data_audiencia) <= addDays(now, 7))
          alertas.push({ tipo: "alerta", titulo: `Audiência em ${differenceInDays(new Date(p.data_audiencia), now)} dias`, processo: p });
        if ((p.valor_causa || 0) > 100000 && !p.prioridade) alertas.push({ tipo: "info", titulo: "Alto valor sem prioridade", processo: p });
      }
    });

    return {
      total: filtered.length, ativos: ativos.length, ganhos, perdidos, acordos,
      valorCausa, valorHonorarios, ticketMedio, taxaExito, taxaConciliacao, tempoMedio,
      parados30: parados30.length, parados60: parados60.length, parados90: parados90.length,
      aud7: aud7.length, aud15: aud15.length, aud30: aud30.length,
      porTipo, statusMap, topPartes, topComarcas, porResponsavel, meses,
      alertas: alertas.slice(0, 15),
      proximasAudiencias: filtered.filter(p => p.data_audiencia && new Date(p.data_audiencia) >= now && new Date(p.data_audiencia) <= addDays(now, 30))
        .sort((a, b) => new Date(a.data_audiencia!).getTime() - new Date(b.data_audiencia!).getTime()).slice(0, 10),
    };
  }, [filtered, responsaveis]);

  if (loading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground">Carregando dados jurídicos...</div>;
  }

  const statusChart = {
    labels: Object.keys(stats.statusMap).map(s => STATUS_LABELS[s] || s),
    datasets: [{
      data: Object.values(stats.statusMap),
      backgroundColor: ["hsl(210, 80%, 55%)", "hsl(40, 90%, 55%)", "hsl(270, 60%, 55%)", "hsl(0, 0%, 60%)", "hsl(142, 70%, 45%)", "hsl(0, 70%, 50%)", "hsl(220, 10%, 70%)", "hsl(160, 60%, 50%)", "hsl(30, 80%, 55%)", "hsl(190, 70%, 50%)", "hsl(330, 60%, 55%)", "hsl(280, 50%, 55%)"],
    }],
  };

  const tipoChart = {
    labels: stats.porTipo.map(t => TIPO_LABELS[t.tipo] || t.tipo),
    datasets: [{ label: "Processos", data: stats.porTipo.map(t => t.count), backgroundColor: "hsl(var(--primary))", borderRadius: 6 }],
  };

  const evolucaoChart = {
    labels: stats.meses.map(m => m.mes),
    datasets: [
      { label: "Novos", data: stats.meses.map(m => m.novos), borderColor: "hsl(210, 80%, 55%)", backgroundColor: "hsla(210, 80%, 55%, 0.2)", tension: 0.3, fill: true },
      { label: "Finalizados", data: stats.meses.map(m => m.finalizados), borderColor: "hsl(142, 70%, 45%)", backgroundColor: "hsla(142, 70%, 45%, 0.2)", tension: 0.3, fill: true },
    ],
  };

  return (
    <div className="space-y-6">
      {/* ───── Filtros ───── */}
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Período:</span>
            <Select value={periodFilter} onValueChange={(v: any) => setPeriodFilter(v)}>
              <SelectTrigger className="w-[140px] h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
                <SelectItem value="180">Últimos 6 meses</SelectItem>
                <SelectItem value="365">Último ano</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Gavel className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Tipo:</span>
            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger className="w-[180px] h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {Object.entries(TIPO_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Responsável:</span>
            <Select value={responsavelFilter} onValueChange={setResponsavelFilter}>
              <SelectTrigger className="w-[180px] h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {Object.entries(responsaveis).map(([id, n]) => <SelectItem key={id} value={id}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Badge variant="outline" className="ml-auto">{stats.total} processos</Badge>
        </CardContent>
      </Card>

      {/* ───── Cards principais (4) ───── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2"><Scale className="h-4 w-4 text-primary" /><span className="text-xs text-muted-foreground">Total</span></div>
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">{stats.ativos} ativos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2"><DollarSign className="h-4 w-4 text-green-500" /><span className="text-xs text-muted-foreground">Valor em Causa</span></div>
            <p className="text-2xl font-bold">{fmtBRL(stats.valorCausa)}</p>
            <p className="text-xs text-muted-foreground">Honorários: {fmtBRL(stats.valorHonorarios)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2"><TrendingUp className="h-4 w-4 text-emerald-500" /><span className="text-xs text-muted-foreground">Taxa de Êxito</span></div>
            <p className="text-2xl font-bold">{stats.taxaExito.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground"><span className="text-green-500">{stats.ganhos}G</span> / <span className="text-red-500">{stats.perdidos}P</span> / <span className="text-teal-500">{stats.acordos}A</span></p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2"><Clock className="h-4 w-4 text-amber-500" /><span className="text-xs text-muted-foreground">Tempo Médio</span></div>
            <p className="text-2xl font-bold">{stats.tempoMedio}<span className="text-sm font-normal text-muted-foreground"> dias</span></p>
            <p className="text-xs text-muted-foreground">Tramitação até finalização</p>
          </CardContent>
        </Card>
      </div>

      {/* ───── Cards secundários (4) ───── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2"><Target className="h-4 w-4 text-blue-500" /><span className="text-xs text-muted-foreground">Ticket Médio</span></div>
            <p className="text-xl font-bold">{fmtBRL(stats.ticketMedio)}</p>
            <p className="text-xs text-muted-foreground">por processo</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2"><Activity className="h-4 w-4 text-teal-500" /><span className="text-xs text-muted-foreground">Taxa Conciliação</span></div>
            <p className="text-xl font-bold">{stats.taxaConciliacao.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground">{stats.acordos} acordos firmados</p>
          </CardContent>
        </Card>
        <Card className={stats.parados90 > 0 ? "border-red-500/30 bg-red-500/5" : ""}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2"><Pause className="h-4 w-4 text-red-500" /><span className="text-xs text-muted-foreground">Processos Parados</span></div>
            <p className="text-xl font-bold">{stats.parados30}</p>
            <p className="text-xs text-muted-foreground">+30d • {stats.parados60} +60d • <span className="text-red-500 font-semibold">{stats.parados90}</span> +90d</p>
          </CardContent>
        </Card>
        <Card className={stats.aud7 > 0 ? "border-amber-500/30 bg-amber-500/5" : ""}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2"><AlertTriangle className="h-4 w-4 text-amber-500" /><span className="text-xs text-muted-foreground">Audiências Críticas</span></div>
            <p className="text-xl font-bold">{stats.aud7}</p>
            <p className="text-xs text-muted-foreground">7d • {stats.aud15} 15d • {stats.aud30} 30d</p>
          </CardContent>
        </Card>
      </div>

      {/* ───── Alertas Inteligentes ───── */}
      {stats.alertas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileWarning className="h-4 w-4 text-amber-500" />
              Alertas Inteligentes ({stats.alertas.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-auto">
              {stats.alertas.map((a, i) => (
                <div key={i} className={`flex items-center justify-between p-2 rounded-lg border text-sm ${
                  a.tipo === "critico" ? "border-red-500/30 bg-red-500/5" :
                  a.tipo === "alerta" ? "border-amber-500/30 bg-amber-500/5" :
                  "border-blue-500/30 bg-blue-500/5"
                }`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={
                      a.tipo === "critico" ? "text-red-500" :
                      a.tipo === "alerta" ? "text-amber-500" :
                      "text-blue-500"
                    }>●</span>
                    <span className="font-medium truncate">{a.processo.numero_processo || "Sem nº"}</span>
                    <span className="text-muted-foreground truncate">{a.titulo}</span>
                  </div>
                  <Badge variant="outline" className="text-xs">{TIPO_LABELS[a.processo.tipo] || a.processo.tipo}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ───── Evolução Temporal ───── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2"><Activity className="h-4 w-4" />Evolução (últimos 6 meses)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <Line data={evolucaoChart} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } }} />
          </div>
        </CardContent>
      </Card>

      {/* ───── Gráficos Status & Tipo ───── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium flex items-center gap-2"><Gavel className="h-4 w-4" />Por Status</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center">
              <Doughnut data={statusChart} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 10 } } } } }} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium flex items-center gap-2"><Scale className="h-4 w-4" />Por Tipo</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <Bar data={tipoChart} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ───── Performance por Responsável ───── */}
      {stats.porResponsavel.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-500" />Performance da Equipe</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.porResponsavel.slice(0, 8).map(r => {
                const taxa = r.total ? (r.ganhos / r.total) * 100 : 0;
                return (
                  <div key={r.id} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{r.nome}</span>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{r.total} proc.</span>
                        <span className="text-blue-500">{r.ativos} ativos</span>
                        <span className="text-green-500">{r.ganhos} ganhos</span>
                        <span>{fmtBRL(r.valor)}</span>
                      </div>
                    </div>
                    <Progress value={taxa} className="h-2" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ───── Top Partes & Comarcas ───── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {stats.topPartes.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-sm font-medium flex items-center gap-2"><Users className="h-4 w-4" />Top Partes Contrárias</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats.topPartes.map(([nome, count], i) => (
                  <div key={i} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                    <span className="truncate flex-1">{i + 1}. {nome}</span>
                    <Badge variant="outline">{count} proc.</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        {stats.topComarcas.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-sm font-medium flex items-center gap-2"><Building2 className="h-4 w-4" />Top Comarcas</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats.topComarcas.map(([nome, count], i) => (
                  <div key={i} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                    <span className="truncate flex-1">{i + 1}. {nome}</span>
                    <Badge variant="outline">{count} proc.</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Kanban */}
      <JuridicoKanban userCompanyId={userCompanyId} />

      {/* Próximas Audiências */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" />Próximas Audiências (30 dias)</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.proximasAudiencias.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma audiência agendada</p>
          ) : (
            <div className="space-y-2">
              {stats.proximasAudiencias.map(aud => (
                <div key={aud.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{aud.numero_processo || "Sem nº"}</p>
                    <p className="text-xs text-muted-foreground truncate">vs {aud.parte_contraria || "—"} {aud.vara && `• ${aud.vara}`}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant="outline" className="text-xs">{TIPO_LABELS[aud.tipo] || aud.tipo}</Badge>
                    <Badge className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/20" variant="outline">
                      {format(new Date(aud.data_audiencia!), "dd/MM HH:mm", { locale: ptBR })}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
