import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, TrendingUp, TrendingDown, Trophy, X } from "lucide-react";
import { useWMIAlerts, useAcknowledgeAlert } from "@/hooks/useMaturityIntel";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const SEVERITY: Record<string, string> = {
  high: "border-rose-500/40 bg-rose-500/5",
  medium: "border-amber-500/40 bg-amber-500/5",
  low: "border-sky-500/40 bg-sky-500/5",
};

export function WMIAlertsPanel() {
  const { data: alerts, isLoading } = useWMIAlerts();
  const ack = useAcknowledgeAlert();

  if (isLoading) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-5 w-5 text-amber-500" /> Alertas Inteligentes
          {alerts && alerts.length > 0 && (
            <Badge variant="destructive" className="ml-auto">{alerts.length}</Badge>
          )}
        </CardTitle>
        <CardDescription>
          Detecção automática de regressões e marcos no seu WMI Score.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!alerts || alerts.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            <Trophy className="h-8 w-8 mx-auto mb-2 text-emerald-500/60" />
            <p>Nenhum alerta no momento. Tudo sob controle.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {alerts.map((a) => {
              const Icon = a.alert_type === "regression" ? TrendingDown
                : a.alert_type === "improvement" ? TrendingUp
                : Trophy;
              return (
                <div key={a.id} className={`flex gap-3 p-3 rounded-lg border ${SEVERITY[a.severity]}`}>
                  <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${
                    a.alert_type === "regression" ? "text-rose-500" :
                    a.alert_type === "improvement" ? "text-emerald-500" : "text-amber-500"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">{a.title}</p>
                      {a.pillar && <Badge variant="outline" className="text-[10px] capitalize">{a.pillar}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{a.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                  <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => ack.mutate(a.id)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
