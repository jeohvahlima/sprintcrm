import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PhoneCall, Phone, Clock, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { HunterLead, HunterEvent } from "@/hooks/useHunterPipeline";
import { useCallCenter } from "@/hooks/useCallCenter";

interface Props {
  open: boolean;
  onClose: () => void;
  lead: HunterLead | null;
  fetchEvents: (id: string) => Promise<HunterEvent[]>;
  onLogAttempt: (substatus: string) => void;
}

export function HunterLeadDrawer({ open, onClose, lead, fetchEvents, onLogAttempt }: Props) {
  const [events, setEvents] = useState<HunterEvent[]>([]);
  const callCenter = useCallCenter();

  useEffect(() => {
    if (open && lead) fetchEvents(lead.id).then(setEvents);
  }, [open, lead, fetchEvents]);

  if (!lead) return null;

  const startCall = () => {
    if (!lead.lead_phone) return;
    callCenter.startCall({
      phoneNumber: lead.lead_phone,
      leadName: lead.lead_name || "Lead",
      leadId: lead.lead_id || undefined,
    } as any);
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-hidden flex flex-col">
        <SheetHeader>
          <SheetTitle>{lead.lead_name || "Lead"}</SheetTitle>
        </SheetHeader>

        <div className="space-y-3 mt-3 text-sm">
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary">{lead.stage.replace("_", " ")}</Badge>
            {lead.substatus && <Badge variant="outline">{lead.substatus}</Badge>}
            {lead.decisor_classificacao && (
              <Badge className={
                lead.decisor_classificacao === "A" ? "bg-red-500/15 text-red-600 border-red-500/30" :
                lead.decisor_classificacao === "B" ? "bg-amber-500/15 text-amber-600 border-amber-500/30" :
                "bg-green-500/15 text-green-600 border-green-500/30"
              }>
                Classificação {lead.decisor_classificacao}
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1"><Phone className="h-3 w-3" />{lead.lead_phone || "—"}</div>
            <div className="flex items-center gap-1"><Clock className="h-3 w-3" />{lead.attempts} tentativas</div>
          </div>

          {lead.dor_identificada && (
            <div className="rounded-md border p-2 text-xs">
              <p className="font-semibold mb-1">Dor identificada</p>
              <p className="text-muted-foreground">{lead.dor_identificada}</p>
            </div>
          )}

          {lead.next_action_at && (
            <div className="rounded-md border p-2 text-xs flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-amber-500" />
              <div>
                <p className="font-semibold">Próxima ação</p>
                <p className="text-muted-foreground">
                  {format(new Date(lead.next_action_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  {lead.next_action_reason ? ` — ${lead.next_action_reason}` : ""}
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button size="sm" onClick={startCall} disabled={!lead.lead_phone} className="flex-1">
              <PhoneCall className="h-3.5 w-3.5 mr-1" /> Click-to-Call
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            <Button size="sm" variant="outline" onClick={() => onLogAttempt("nao_atendeu")}>Não atendeu</Button>
            <Button size="sm" variant="outline" onClick={() => onLogAttempt("ocupado")}>Ocupado</Button>
            <Button size="sm" variant="outline" onClick={() => onLogAttempt("caixa_postal")}>Caixa postal</Button>
          </div>

          <div>
            <p className="text-xs font-semibold mb-1.5">Histórico</p>
            <ScrollArea className="h-[260px] rounded-md border p-2">
              {events.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Sem eventos</p>
              ) : (
                <div className="space-y-2">
                  {events.map((ev) => (
                    <div key={ev.id} className="text-xs border-l-2 border-primary/30 pl-2">
                      <p className="font-medium">
                        {ev.event_type}
                        {ev.points > 0 && <span className="ml-2 text-emerald-600">+{ev.points} pts</span>}
                      </p>
                      <p className="text-muted-foreground">
                        {format(new Date(ev.created_at), "dd/MM HH:mm", { locale: ptBR })}
                        {ev.payload?.substatus ? ` · ${ev.payload.substatus}` : ""}
                        {ev.from_stage && ev.to_stage && ev.from_stage !== ev.to_stage
                          ? ` · ${ev.from_stage} → ${ev.to_stage}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
