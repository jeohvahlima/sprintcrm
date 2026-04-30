import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Scale, Gavel, Clock, DollarSign, TrendingUp, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { Bar, Doughnut } from "react-chartjs-2";
import JuridicoKanban from "./JuridicoKanban";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface LegalStats {
  total: number;
  emAndamento: number;
  aguardandoAudiencia: number;
  suspensos: number;
  ganhos: number;
  perdidos: number;
  arquivados: number;
  valorTotalCausa: number;
  valorTotalHonorarios: number;
  porTipo: { tipo: string; count: number }[];
  proximasAudiencias: {
    id: string;
    numero_processo: string;
    parte_contraria: string;
    data_audiencia: string;
    vara: string;
    tipo: string;
  }[];
}

const STATUS_LABELS: Record<string, string> = {
  pre_processual: "Pré-Processual",
  protocolado: "Protocolado",
  em_andamento: "Em Andamento",
  aguardando_citacao: "Ag. Citação",
  aguardando_contestacao: "Ag. Contestação",
  aguardando_audiencia: "Aguardando Audiência",
  aguardando_pericia: "Aguardando Perícia",
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

export default function JuridicoAnalytics({ userCompanyId }: { userCompanyId: string | null }) {
  const [stats, setStats] = useState<LegalStats>({
    total: 0, emAndamento: 0, aguardandoAudiencia: 0, suspensos: 0,
    ganhos: 0, perdidos: 0, arquivados: 0, valorTotalCausa: 0,
    valorTotalHonorarios: 0, porTipo: [], proximasAudiencias: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userCompanyId) return;
    fetchStats();
  }, [userCompanyId]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const { data: processes } = await supabase
        .from("legal_processes")
        .select("*")
        .eq("company_id", userCompanyId!);

      if (!processes) return;

      const emAndamento = processes.filter(p => p.status === "em_andamento").length;
      const aguardandoAudiencia = processes.filter(p => p.status === "aguardando_audiencia").length;
      const suspensos = processes.filter(p => p.status === "suspenso").length;
      const ganhos = processes.filter(p => p.status === "ganho").length;
      const perdidos = processes.filter(p => p.status === "perdido").length;
      const arquivados = processes.filter(p => p.status === "arquivado").length;

      const valorTotalCausa = processes.reduce((sum, p) => sum + (Number(p.valor_causa) || 0), 0);
      const valorTotalHonorarios = processes.reduce((sum, p) => sum + (Number(p.valor_honorarios) || 0), 0);

      // Group by tipo
      const tipoMap: Record<string, number> = {};
      processes.forEach(p => {
        tipoMap[p.tipo] = (tipoMap[p.tipo] || 0) + 1;
      });
      const porTipo = Object.entries(tipoMap).map(([tipo, count]) => ({ tipo, count }));

      // Próximas audiências (30 dias)
      const now = new Date();
      const in30Days = addDays(now, 30);
      const proximasAudiencias = processes
        .filter(p => p.data_audiencia && new Date(p.data_audiencia) >= now && new Date(p.data_audiencia) <= in30Days)
        .sort((a, b) => new Date(a.data_audiencia!).getTime() - new Date(b.data_audiencia!).getTime())
        .slice(0, 10)
        .map(p => ({
          id: p.id,
          numero_processo: p.numero_processo || "Sem número",
          parte_contraria: p.parte_contraria || "N/A",
          data_audiencia: p.data_audiencia!,
          vara: p.vara || "",
          tipo: p.tipo,
        }));

      setStats({
        total: processes.length, emAndamento, aguardandoAudiencia, suspensos,
        ganhos, perdidos, arquivados, valorTotalCausa, valorTotalHonorarios,
        porTipo, proximasAudiencias,
      });
    } finally {
      setLoading(false);
    }
  };

  const taxaExito = stats.ganhos + stats.perdidos > 0
    ? ((stats.ganhos / (stats.ganhos + stats.perdidos)) * 100).toFixed(1)
    : "0";

  const statusChartData = {
    labels: ["Em Andamento", "Ag. Audiência", "Suspenso", "Ganho", "Perdido", "Arquivado"],
    datasets: [{
      data: [stats.emAndamento, stats.aguardandoAudiencia, stats.suspensos, stats.ganhos, stats.perdidos, stats.arquivados],
      backgroundColor: [
        "hsl(210, 80%, 55%)", "hsl(40, 90%, 55%)", "hsl(0, 0%, 60%)",
        "hsl(142, 70%, 45%)", "hsl(0, 70%, 50%)", "hsl(220, 10%, 70%)",
      ],
    }],
  };

  const tipoChartData = {
    labels: stats.porTipo.map(t => TIPO_LABELS[t.tipo] || t.tipo),
    datasets: [{
      label: "Processos",
      data: stats.porTipo.map(t => t.count),
      backgroundColor: "hsl(210, 80%, 55%)",
      borderRadius: 6,
    }],
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground">Carregando dados jurídicos...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Cards de Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Scale className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Total de Processos</span>
            </div>
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">{stats.emAndamento} ativos</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Valor em Causa</span>
            </div>
            <p className="text-2xl font-bold">
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact" }).format(stats.valorTotalCausa)}
            </p>
            <p className="text-xs text-muted-foreground">
              Honorários: {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact" }).format(stats.valorTotalHonorarios)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Taxa de Êxito</span>
            </div>
            <p className="text-2xl font-bold">{taxaExito}%</p>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-500">{stats.ganhos} ganhos</span> / <span className="text-red-500">{stats.perdidos} perdidos</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-amber-500" />
              <span className="text-sm text-muted-foreground">Audiências Próximas</span>
            </div>
            <p className="text-2xl font-bold">{stats.proximasAudiencias.length}</p>
            <p className="text-xs text-muted-foreground">Próximos 30 dias</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Gavel className="h-4 w-4" />
              Processos por Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center">
              <Doughnut data={statusChartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } } } }} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Scale className="h-4 w-4" />
              Processos por Tipo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <Bar data={tipoChartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Kanban de Processos */}
      <JuridicoKanban userCompanyId={userCompanyId} />

      {/* Próximas Audiências */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Próximas Audiências (30 dias)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.proximasAudiencias.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma audiência agendada nos próximos 30 dias</p>
          ) : (
            <div className="space-y-2">
              {stats.proximasAudiencias.map(aud => (
                <div key={aud.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{aud.numero_processo}</p>
                    <p className="text-xs text-muted-foreground">vs {aud.parte_contraria} {aud.vara && `• ${aud.vara}`}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {TIPO_LABELS[aud.tipo] || aud.tipo}
                    </Badge>
                    <Badge className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/20" variant="outline">
                      {format(new Date(aud.data_audiencia), "dd/MM/yyyy HH:mm", { locale: ptBR })}
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
