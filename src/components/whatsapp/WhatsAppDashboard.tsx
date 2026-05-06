import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  MessageSquare, 
  CheckCircle2, 
  Eye, 
  Reply,
  XCircle, 
  RefreshCw, 
  TrendingUp,
  DollarSign,
  BarChart3,
  Calendar,
  Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from "recharts";

interface DashboardProps {
  companyId: string;
}

interface Analytics {
  period: {
    start: string;
    end: string;
    type: string;
  };
  metrics: {
    total_sent: number;
    total_delivered: number;
    total_read: number;
    total_failed: number;
    total_pending: number;
    total_replied: number;
    delivery_rate: number;
    read_rate: number;
    reply_rate: number;
    estimated_cost: number;
    by_provider: {
      meta: number;
      evolution: number;
    };
    by_template: Record<string, number>;
  };
  chart_data: Array<{
    date: string;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
  }>;
  campaigns: Array<{
    id: string;
    campaign_name: string;
    template_name?: string;
    total_sent: number;
    total_delivered: number;
    total_read: number;
    total_failed: number;
    total_replied: number;
    estimated_cost: number;
    created_at: string;
  }>;
  meta_official?: {
    messages_sent: number;
    messages_delivered: number;
    messages_read: number;
    messages_clicked: number;
    messages_received: number;
    paid_delivered: number;
    free_delivered: number;
    total_cost: number;
    by_category: Record<string, { delivered: number; cost: number }>;
    by_template: Record<string, { sent: number; delivered: number; read: number; clicked: number; cost: number }>;
  } | null;
}

export function WhatsAppDashboard({ companyId }: DashboardProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState("week");
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [metaNotConfigured, setMetaNotConfigured] = useState(false);

  const loadAnalytics = async () => {
    try {
      setRefreshing(true);
      setMetaNotConfigured(false);
      
      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;
      
      if (!accessToken) {
        throw new Error('Usuário não autenticado');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-analytics?company_id=${companyId}&period=${period}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const result = await response.json();

      if (!response.ok) {
        // Verificar se é erro de conexão não configurada
        if (result.error?.includes('não configurada') || result.error?.includes('not configured')) {
          setMetaNotConfigured(true);
          setAnalytics(null);
          return;
        }
        throw new Error(result.error || 'Erro ao carregar analytics');
      }

      setAnalytics(result);
    } catch (error: any) {
      console.error('Erro ao carregar analytics:', error);
      if (error.message?.includes('não configurada') || error.message?.includes('not configured')) {
        setMetaNotConfigured(true);
        setAnalytics(null);
      } else {
        toast({
          variant: "destructive",
          title: "Erro ao carregar métricas",
          description: error.message
        });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (companyId) {
      loadAnalytics();
    }
  }, [companyId, period]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Mostrar mensagem quando Meta não está configurada
  if (metaNotConfigured) {
    return (
      <Card className="border-yellow-500/30 bg-yellow-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-yellow-700">
            <XCircle className="h-5 w-5" />
            Conexão Meta não Configurada
          </CardTitle>
          <CardDescription>
            Para visualizar métricas da API oficial do WhatsApp, configure a conexão com a Meta API primeiro.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-2">
            <p>Para configurar:</p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Acesse a aba <strong>"Canais"</strong> nas configurações</li>
              <li>Encontre a seção <strong>"Meta API (WhatsApp Business)"</strong></li>
              <li>Configure o <strong>Phone Number ID</strong> e o <strong>Access Token</strong></li>
              <li>Salve as configurações e volte aqui</li>
            </ol>
          </div>
          <Button variant="outline" onClick={loadAnalytics}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Verificar Novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  const metrics = analytics?.metrics;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Dashboard WhatsApp</h2>
          <p className="text-muted-foreground">
            Métricas em tempo real de mensagens e campanhas
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[140px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Hoje</SelectItem>
              <SelectItem value="week">Última Semana</SelectItem>
              <SelectItem value="month">Último Mês</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={loadAnalytics} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Métricas Principais */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Enviadas</p>
                <p className="text-2xl font-bold">{metrics?.total_sent || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Entregues</p>
                <p className="text-2xl font-bold">{metrics?.total_delivered || 0}</p>
                <p className="text-xs text-muted-foreground">{metrics?.delivery_rate || 0}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <Eye className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Lidas</p>
                <p className="text-2xl font-bold">{metrics?.total_read || 0}</p>
                <p className="text-xs text-muted-foreground">{metrics?.read_rate || 0}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900 rounded-lg">
                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Falhas</p>
                <p className="text-2xl font-bold">{metrics?.total_failed || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent rounded-lg">
                <Reply className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Responderam</p>
                <p className="text-2xl font-bold">{metrics?.total_replied || 0}</p>
                <p className="text-xs text-muted-foreground">{metrics?.reply_rate || 0}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Custo Estimado e Provider */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
                <DollarSign className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Custo Estimado</p>
                <p className="text-2xl font-bold">{formatCurrency(metrics?.estimated_cost || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground mb-2">Por Provider</p>
            <div className="flex gap-4">
              <Badge variant="outline" className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                Meta: {metrics?.by_provider?.meta || 0}
              </Badge>
              <Badge variant="outline" className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                Evolution: {metrics?.by_provider?.evolution || 0}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground mb-2">Período</p>
            <p className="text-sm">
              {analytics?.period?.start ? formatDate(analytics.period.start) : '-'} até{' '}
              {analytics?.period?.end ? formatDate(analytics.period.end) : '-'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* === Métricas Oficiais Meta (WhatsApp Manager) === */}
      {analytics?.meta_official && (
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Dados Oficiais Meta (WhatsApp Manager)
            </CardTitle>
            <CardDescription>
              Mesmas métricas que aparecem no painel oficial do WhatsApp Business — entregues, lidas, cliques e custo real por categoria.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Enviadas (Meta)</p>
                <p className="text-xl font-bold">{analytics.meta_official.messages_sent}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Entregues (Meta)</p>
                <p className="text-xl font-bold">{analytics.meta_official.messages_delivered}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Lidas (Meta)</p>
                <p className="text-xl font-bold">{analytics.meta_official.messages_read}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Cliques</p>
                <p className="text-xl font-bold">{analytics.meta_official.messages_clicked}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Pagas entregues</p>
                <p className="text-xl font-bold">{analytics.meta_official.paid_delivered}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Grátis entregues</p>
                <p className="text-xl font-bold">{analytics.meta_official.free_delivered}</p>
              </div>
              <div className="rounded-lg border p-3 bg-yellow-50 dark:bg-yellow-950/20">
                <p className="text-xs text-muted-foreground">Cobrança Meta (USD)</p>
                <p className="text-xl font-bold">${analytics.meta_official.total_cost.toFixed(2)}</p>
              </div>
            </div>

            {Object.keys(analytics.meta_official.by_category || {}).length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Por categoria</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {Object.entries(analytics.meta_official.by_category).map(([cat, v]) => (
                    <div key={cat} className="flex items-center justify-between rounded-md border px-3 py-2">
                      <span className="text-sm capitalize">{cat}</span>
                      <span className="text-xs text-muted-foreground">
                        {v.delivered} msgs · ${v.cost.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Gráficos */}
      <Tabs defaultValue="timeline" className="space-y-4">
        <TabsList>
          <TabsTrigger value="timeline">Linha do Tempo</TabsTrigger>
          <TabsTrigger value="templates">Por Template</TabsTrigger>
          <TabsTrigger value="campaigns">Campanhas</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Volume de Mensagens
              </CardTitle>
            </CardHeader>
            <CardContent>
              {analytics?.chart_data && analytics.chart_data.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analytics.chart_data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={formatDate} />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(label) => formatDate(label as string)}
                      formatter={(value, name) => [value, name === 'sent' ? 'Enviadas' : name === 'delivered' ? 'Entregues' : name === 'read' ? 'Lidas' : 'Falhas']}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="sent" name="Enviadas" stroke="#3b82f6" strokeWidth={2} />
                    <Line type="monotone" dataKey="delivered" name="Entregues" stroke="#22c55e" strokeWidth={2} />
                    <Line type="monotone" dataKey="read" name="Lidas" stroke="#a855f7" strokeWidth={2} />
                    <Line type="monotone" dataKey="failed" name="Falhas" stroke="#ef4444" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  Nenhum dado disponível para o período selecionado
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Uso por Template
              </CardTitle>
            </CardHeader>
            <CardContent>
              {metrics?.by_template && Object.keys(metrics.by_template).length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={Object.entries(metrics.by_template).map(([name, count]) => ({ name, count }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" name="Mensagens" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  Nenhum template utilizado no período
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="campaigns">
          <Card>
            <CardHeader>
              <CardTitle>Campanhas Recentes</CardTitle>
              <CardDescription>Últimas 10 campanhas de disparo</CardDescription>
            </CardHeader>
            <CardContent>
              {analytics?.campaigns && analytics.campaigns.length > 0 ? (
                <div className="space-y-3">
                  {analytics.campaigns.map((campaign) => (
                    <div key={campaign.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{campaign.campaign_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(campaign.created_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="text-center">
                          <p className="font-bold">{campaign.total_sent}</p>
                          <p className="text-muted-foreground">Enviadas</p>
                        </div>
                        <div className="text-center">
                          <p className="font-bold text-green-600">{campaign.total_delivered}</p>
                          <p className="text-muted-foreground">Entregues</p>
                        </div>
                        <div className="text-center">
                          <p className="font-bold text-purple-600">{campaign.total_read}</p>
                          <p className="text-muted-foreground">Lidas</p>
                        </div>
                        <div className="text-center">
                          <p className="font-bold">{campaign.total_replied || 0}</p>
                          <p className="text-muted-foreground">Responderam</p>
                        </div>
                        <div className="text-center">
                          <p className="font-bold text-destructive">{campaign.total_failed || 0}</p>
                          <p className="text-muted-foreground">Falhas</p>
                        </div>
                        <div className="text-center">
                          <p className="font-bold">{formatCurrency(campaign.estimated_cost)}</p>
                          <p className="text-muted-foreground">Custo</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-32 text-muted-foreground">
                  Nenhuma campanha registrada
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}