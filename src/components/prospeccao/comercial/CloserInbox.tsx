import { useMyHandoffsAsCloser, useUpdateHandoff } from "@/hooks/useHandoffs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Calendar, DollarSign, MessageSquare, Inbox, TrendingUp, Star } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function CloserInbox() {
  const { data: handoffs = [], isLoading } = useMyHandoffsAsCloser();
  const update = useUpdateHandoff();

  const handleAction = async (id: string, status: string, msg: string) => {
    try {
      const patch: any = { status };
      if (status === "accepted") patch.accepted_at = new Date().toISOString();
      if (status === "meeting_done") patch.meeting_done_at = new Date().toISOString();
      if (status === "sale_closed" || status === "lost") patch.closed_at = new Date().toISOString();
      await update.mutateAsync({ id, ...patch });
      toast.success(msg);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Carregando caixa de entrada...</div>;

  if (handoffs.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Inbox className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
        <h3 className="font-semibold mb-1">Sua caixa está vazia</h3>
        <p className="text-sm text-muted-foreground">Quando um SDR transferir um lead qualificado, ele aparecerá aqui.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Inbox className="h-4 w-4" /> Caixa do Closer
          <Badge variant="secondary">{handoffs.length}</Badge>
        </h3>
      </div>

      {handoffs.map((h: any) => {
        const lead = h.lead || {};
        return (
          <Card key={h.id} className="p-4 border-primary/20">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-[240px]">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h4 className="font-semibold">{lead.name || "Lead"}</h4>
                  <Badge variant={h.status === "pending" ? "default" : "secondary"}>{h.status}</Badge>
                  {h.qualification_score && (
                    <span className="flex items-center gap-1 text-xs text-amber-500">
                      <Star className="h-3 w-3 fill-amber-500" /> {h.qualification_score}/10
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  {lead.phone || lead.telefone} {lead.email && `· ${lead.email}`}
                </p>

                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-2">
                  {h.scheduled_meeting_at && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(h.scheduled_meeting_at), "dd/MM HH:mm", { locale: ptBR })}
                    </span>
                  )}
                  {h.expected_value > 0 && (
                    <span className="flex items-center gap-1 text-emerald-600">
                      <DollarSign className="h-3 w-3" />
                      R$ {Number(h.expected_value).toLocaleString("pt-BR")}
                    </span>
                  )}
                </div>

                {h.sdr_notes && (
                  <div className="text-sm bg-muted/50 rounded p-2 border-l-2 border-primary mt-2">
                    <div className="flex items-center gap-1 text-xs font-medium mb-1 text-primary">
                      <MessageSquare className="h-3 w-3" /> Nota do SDR
                    </div>
                    {h.sdr_notes}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                {h.status === "pending" && (
                  <>
                    <Button size="sm" onClick={() => handleAction(h.id, "accepted", "Lead aceito")}>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Aceitar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleAction(h.id, "rejected", "Lead recusado")}>
                      <XCircle className="h-3.5 w-3.5 mr-1" /> Recusar
                    </Button>
                  </>
                )}
                {(h.status === "accepted" || h.status === "meeting_scheduled") && (
                  <>
                    <Button size="sm" onClick={() => handleAction(h.id, "meeting_done", "Reunião concluída")}>
                      <Calendar className="h-3.5 w-3.5 mr-1" /> Reunião feita
                    </Button>
                    <Button size="sm" variant="default" className="bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => handleAction(h.id, "sale_closed", "Venda fechada! 🎉")}>
                      <TrendingUp className="h-3.5 w-3.5 mr-1" /> Vendido
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleAction(h.id, "lost", "Lead perdido")}>
                      Perdido
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
