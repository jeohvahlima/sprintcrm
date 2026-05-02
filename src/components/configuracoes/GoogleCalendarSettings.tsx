import { Calendar, CheckCircle2, RefreshCw, Unplug, Link2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export function GoogleCalendarSettings() {
  const { integration, isConnected, loading, busy, connect, disconnect, sync } = useGoogleCalendar();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Calendar className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              Google Calendar
              {isConnected && (
                <Badge variant="default" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Conectado
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Conecte sua conta para sincronizar compromissos, enviar convites por e-mail e receber lembretes.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="text-sm text-muted-foreground">Carregando...</div>
        ) : isConnected && integration ? (
          <>
            <div className="rounded-md border p-3 space-y-1 text-sm">
              <div><span className="text-muted-foreground">Conta:</span> <span className="font-medium">{integration.google_email}</span></div>
              <div><span className="text-muted-foreground">Calendário:</span> {integration.calendar_id}</div>
              {integration.last_sync_at && (
                <div className="text-xs text-muted-foreground">
                  Última sincronização: {format(parseISO(integration.last_sync_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={sync} disabled={busy} variant="default" size="sm">
                <RefreshCw className={`h-4 w-4 mr-2 ${busy ? "animate-spin" : ""}`} />
                Sincronizar agora
              </Button>
              <Button onClick={disconnect} disabled={busy} variant="outline" size="sm">
                <Unplug className="h-4 w-4 mr-2" /> Desconectar
              </Button>
            </div>
            <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
              <div className="font-medium text-foreground">Como funciona:</div>
              <div>• Compromissos criados no CRM aparecem automaticamente no seu Google Agenda</div>
              <div>• Eventos do Google são importados ao módulo Agenda</div>
              <div>• Lead com e-mail recebe convite e lembretes</div>
              <div>• Lembretes: popup 10min antes + e-mail 1h e 1 dia antes</div>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Cada vendedor conecta sua própria conta Google. Os compromissos do CRM serão criados no calendário pessoal e os eventos do Google aparecem na sua agenda do Waze.
            </p>
            <Button onClick={connect} disabled={busy}>
              <Link2 className="h-4 w-4 mr-2" />
              {busy ? "Aguarde..." : "Conectar Google Agenda"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
