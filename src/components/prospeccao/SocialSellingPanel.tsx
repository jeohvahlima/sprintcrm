import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Instagram, Flame, MessageSquare, Calendar, TrendingUp, Zap, RefreshCw } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link } from "react-router-dom";

interface SocialLead {
  id: string;
  name: string | null;
  social_score: number | null;
  intent_level: string | null;
  next_action: string | null;
  next_action_at: string | null;
  last_engagement_at: string | null;
  funil_id: string | null;
  etapa_id: string | null;
  etapa_nome?: string | null;
  responsavel_id?: string | null;
  responsavel_nome?: string | null;
  profile_picture_url?: string | null;
}

const intentBadge = (level: string | null) => {
  if (level === "alta") return <Badge className="bg-red-500/15 text-red-500 border-red-500/30">🔥 Alta</Badge>;
  if (level === "media") return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30">⚡ Média</Badge>;
  if (level === "baixa") return <Badge variant="secondary">Baixa</Badge>;
  return <Badge variant="outline">—</Badge>;
};
export function SocialSellingPanel() {
  const [funilOpen, setFunilOpen] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [funilId, setFunilId] = useState<string | null>(null);
  const [leads, setLeads] = useState<SocialLead[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    altaIntencao: 0,
    conversaIniciada: 0,
    qualificados: 0,
    reunioes: 0,
    fechamentos: 0,
    receita: 0,
  });
  const [loading, setLoading] = useState(true);
  const [bootstrapping, setBootstrapping] = useState(false);

  const loadCompany = async () => {
    const { data, error } = await supabase.rpc("get_my_company_id");
    if (error) console.error("[SocialSelling] get_my_company_id", error);
    setCompanyId((data as string) ?? null);
    return (data as string) ?? undefined;
  };

  const loadFunnel = async (cid: string) => {
    const { data } = await supabase
      .from("funis")
      .select("id")
      .eq("company_id", cid)
      .eq("nome", "Social Selling")
      .maybeSingle();
    setFunilId(data?.id ?? null);
    return data?.id as string | undefined;
  };

  const loadLeads = async (cid: string, fid: string | undefined) => {
    setLoading(true);

    // Etapas para mapear nome
    let etapasMap: Record<string, string> = {};
    if (fid) {
      const { data: etapas } = await supabase.from("etapas").select("id, nome").eq("funil_id", fid);
      etapasMap = Object.fromEntries((etapas ?? []).map((e: any) => [e.id, e.nome]));
    }

    // Leads do Instagram (paginação para evitar 1k limit)
    const all: SocialLead[] = [];
    let from = 0;
    const PAGE = 500;
    while (true) {
      const { data, error } = await supabase
        .from("leads")
        .select(
          "id, name, social_score, intent_level, next_action, next_action_at, last_engagement_at, funil_id, etapa_id, responsavel_id, profile_picture_url",
        )
        .eq("company_id", cid)
        .eq("lead_source_type", "instagram")
        .order("social_score", { ascending: false })
        .range(from, from + PAGE - 1);
      if (error) break;
      const rows = (data ?? []) as SocialLead[];
      all.push(...rows.map((r) => ({ ...r, etapa_nome: r.etapa_id ? etapasMap[r.etapa_id] : null })));
      if (rows.length < PAGE) break;
      from += PAGE;
    }

    setLeads(all);

    // Stats
    const altaIntencao = all.filter((l) => l.intent_level === "alta").length;
    const conversaIniciada = all.filter((l) => l.etapa_nome === "Conversa Iniciada").length;
    const qualificados = all.filter((l) => l.etapa_nome === "Lead Qualificado").length;
    const reunioes = all.filter((l) => l.etapa_nome === "Reunião Agendada").length;
    const fechamentos = all.filter((l) => l.etapa_nome === "Fechamento").length;

    // Receita (de leads ganhos com origem instagram)
    const { data: ganhos } = await supabase
      .from("leads")
      .select("value")
      .eq("company_id", cid)
      .eq("lead_source_type", "instagram")
      .eq("status", "ganho");
    const receita = (ganhos ?? []).reduce((s: number, l: any) => s + Number(l.value || 0), 0);

    setStats({
      total: all.length,
      altaIntencao,
      conversaIniciada,
      qualificados,
      reunioes,
      fechamentos,
      receita,
    });
    setLoading(false);
  };

  const refresh = async () => {
    const cid = await loadCompany();
    if (!cid) return;
    const fid = await loadFunnel(cid);
    await loadLeads(cid, fid);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line
  }, []);

  const handleBootstrap = async () => {
    setBootstrapping(true);
    try {
      const { data, error } = await supabase.functions.invoke("social-selling-bootstrap", { body: {} });
      if (error) throw error;
      toast.success("Social Selling ativado!", {
        description: `${data?.migrated_leads ?? 0} leads migrados • ${data?.playbooks_created ?? 0} playbooks criados`,
      });
      await refresh();
    } catch (e: any) {
      toast.error("Falha ao ativar Social Selling", { description: e?.message });
    } finally {
      setBootstrapping(false);
    }
  };

  const taxaResposta = stats.total > 0 ? Math.round((stats.conversaIniciada / stats.total) * 100) : 0;
  const taxaConversao = stats.total > 0 ? Math.round((stats.fechamentos / stats.total) * 100) : 0;

  const topLeads = useMemo(
    () => [...leads].sort((a, b) => (b.social_score ?? 0) - (a.social_score ?? 0)).slice(0, 30),
    [leads],
  );

  if (!funilId) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-4">
          <Sparkles className="h-12 w-12 text-primary" />
          <div>
            <h3 className="text-lg font-semibold">Ative o Social Selling Engine</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1">
              Vamos criar o funil padrão de Social Selling, migrar seus leads do Instagram e instalar
              os playbooks de DM, story, objeção e convite para reunião.
            </p>
          </div>
          <Button onClick={handleBootstrap} disabled={bootstrapping} size="lg">
            {bootstrapping ? "Ativando..." : "🚀 Ativar Social Selling"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Social Selling Engine
          </h2>
          <p className="text-sm text-muted-foreground">
            Transforme seguidores e interações em vendas previsíveis.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={() => setFunilOpen(true)}>
            Ver funil
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <KpiCard icon={<Instagram className="h-4 w-4" />} label="Leads IG" value={stats.total} color="text-primary" />
        <KpiCard icon={<Flame className="h-4 w-4" />} label="Alta intenção" value={stats.altaIntencao} color="text-red-500" />
        <KpiCard icon={<MessageSquare className="h-4 w-4" />} label="Conversas" value={stats.conversaIniciada} color="text-sky-500" />
        <KpiCard icon={<Zap className="h-4 w-4" />} label="Qualificados" value={stats.qualificados} color="text-purple-500" />
        <KpiCard icon={<Calendar className="h-4 w-4" />} label="Reuniões" value={stats.reunioes} color="text-amber-500" />
        <KpiCard icon={<TrendingUp className="h-4 w-4" />} label="Tx resposta" value={`${taxaResposta}%`} color="text-emerald-500" />
        <KpiCard icon={<TrendingUp className="h-4 w-4" />} label="Conversão" value={`${taxaConversao}%`} color="text-emerald-500" />
      </div>

      {/* Receita destacada */}
      <Card>
        <CardContent className="py-4 flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="text-xs text-muted-foreground">Receita gerada via social</p>
            <p className="text-2xl font-bold text-emerald-500">
              {stats.receita.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </p>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            {stats.fechamentos} {stats.fechamentos === 1 ? "venda fechada" : "vendas fechadas"}
          </div>
        </CardContent>
      </Card>

      {/* Tabela top leads */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">🔥 Top Leads de Social Selling</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : topLeads.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nenhum lead do Instagram ainda. Conecte sua conta e aguarde a primeira interação.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead</TableHead>
                    <TableHead>Etapa</TableHead>
                    <TableHead>Intenção</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Próxima ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topLeads.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>
                        <Link to={`/conversas?lead_id=${l.id}`} className="hover:underline font-medium">
                          {l.name || "(sem nome)"}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {l.etapa_nome ? <Badge variant="outline">{l.etapa_nome}</Badge> : "—"}
                      </TableCell>
                      <TableCell>{intentBadge(l.intent_level)}</TableCell>
                      <TableCell className="w-32">
                        <div className="flex items-center gap-2">
                          <Progress value={l.social_score ?? 0} className="h-2 flex-1" />
                          <span className="text-xs text-muted-foreground w-8 text-right">{l.social_score ?? 0}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {l.next_action ? (
                          <span>{l.next_action}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Funil Social Selling */}
      <Dialog open={funilOpen} onOpenChange={setFunilOpen}>
        <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] p-0 overflow-hidden">
          <DialogHeader className="px-4 py-2 border-b">
            <DialogTitle className="text-base">🚀 Funil de Social Selling</DialogTitle>
          </DialogHeader>
          <iframe
            src={`/kanban?embed=1${funilId ? `&funil=${funilId}` : "&funil_nome=Social%20Selling"}`}
            className="w-full h-full border-0"
            title="Funil Social Selling"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className={`flex items-center gap-1 text-xs ${color ?? "text-muted-foreground"}`}>
          {icon} {label}
        </div>
        <p className="text-xl font-bold mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}
