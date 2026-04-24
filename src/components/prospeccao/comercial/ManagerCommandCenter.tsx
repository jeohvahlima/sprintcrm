import { useState } from "react";
import { useTeamPerformance } from "@/hooks/useTeamPerformance";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trophy, Phone, MessageSquare, Calendar, TrendingUp, DollarSign, Users, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";

export function ManagerCommandCenter() {
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("daily");
  const { data: rows = [], isLoading } = useTeamPerformance(period);

  const totalLeads = rows.reduce((s: number, r: any) => s + Number(r.leads_prospected || 0), 0);
  const totalCalls = rows.reduce((s: number, r: any) => s + Number(r.calls || 0), 0);
  const totalMeetings = rows.reduce((s: number, r: any) => s + Number(r.meetings_scheduled || 0), 0);
  const totalSales = rows.reduce((s: number, r: any) => s + Number(r.sales_closed || 0), 0);
  const totalRevenue = rows.reduce((s: number, r: any) => s + Number(r.gross_value || 0), 0);
  const sdrs = rows.filter((r: any) => r.commercial_role === "sdr" || r.commercial_role === "hybrid");
  const closers = rows.filter((r: any) => r.commercial_role === "closer" || r.commercial_role === "hybrid");

  const lowPerformers = rows.filter((r: any) => Number(r.leads_prospected || 0) === 0 && Number(r.calls || 0) === 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Centro de Comando do Gestor
          </h2>
          <p className="text-xs text-muted-foreground">Visão completa do time comercial em tempo real</p>
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant={period === "daily" ? "default" : "outline"} onClick={() => setPeriod("daily")}>Hoje</Button>
          <Button size="sm" variant={period === "weekly" ? "default" : "outline"} onClick={() => setPeriod("weekly")}>Semana</Button>
          <Button size="sm" variant={period === "monthly" ? "default" : "outline"} onClick={() => setPeriod("monthly")}>Mês</Button>
          <Button size="sm" variant="outline" asChild>
            <Link to="/configuracoes/comercial">Configurar</Link>
          </Button>
        </div>
      </div>

      {/* KPIs do Time */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi icon={Users} label="Time" value={`${sdrs.length} SDR · ${closers.length} CL`} />
        <Kpi icon={Phone} label="Ligações" value={totalCalls} />
        <Kpi icon={MessageSquare} label="Leads" value={totalLeads} />
        <Kpi icon={Calendar} label="Reuniões" value={totalMeetings} />
        <Kpi icon={TrendingUp} label="Vendas" value={totalSales} highlight />
        <Kpi icon={DollarSign} label="Receita" value={`R$ ${Number(totalRevenue).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`} highlight />
      </div>

      {lowPerformers.length > 0 && period === "daily" && (
        <Card className="p-3 bg-amber-500/10 border-amber-500/30">
          <div className="flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span className="font-medium">Alerta:</span>
            <span>{lowPerformers.length} {lowPerformers.length === 1 ? "atendente sem atividade" : "atendentes sem atividade"} hoje</span>
          </div>
        </Card>
      )}

      {/* Performance Individual */}
      <Card className="p-0 overflow-hidden">
        <div className="p-3 border-b">
          <h3 className="font-semibold text-sm">Performance Individual</h3>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Carregando...</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            Nenhum atendente cadastrado. Configure papéis em <Link to="/configuracoes/comercial" className="text-primary underline">Config Comercial</Link>.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Atendente</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead className="text-right">Ligações</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Resp.</TableHead>
                  <TableHead className="text-right">Reuniões</TableHead>
                  <TableHead className="text-right">Vendas</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                  <TableHead className="text-right">Conv.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r: any) => (
                  <TableRow key={r.user_id}>
                    <TableCell className="font-medium">{r.user_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{r.commercial_role || "—"}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.team_name || "—"}</TableCell>
                    <TableCell className="text-right">{r.calls}</TableCell>
                    <TableCell className="text-right">{r.leads_prospected}</TableCell>
                    <TableCell className="text-right">{r.responses}</TableCell>
                    <TableCell className="text-right">{r.meetings_scheduled}</TableCell>
                    <TableCell className="text-right font-semibold">{r.sales_closed}</TableCell>
                    <TableCell className="text-right text-emerald-600">
                      R$ {Number(r.gross_value).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                    </TableCell>
                    <TableCell className="text-right text-xs">{r.conversion_rate}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, highlight }: any) {
  return (
    <Card className={`p-3 ${highlight ? "border-primary/30 bg-primary/5" : ""}`}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="text-lg font-bold">{value}</div>
    </Card>
  );
}
