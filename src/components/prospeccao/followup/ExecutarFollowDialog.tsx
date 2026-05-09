import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { MessageCircle, Phone, Instagram, Mail, MessageSquare } from "lucide-react";
import {
  FollowUpEntry,
  FollowChannel,
  FollowOutcome,
  useFollowUpEsteira,
} from "@/hooks/useFollowUpEsteira";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  entry: FollowUpEntry | null;
}

const CHANNELS: { value: FollowChannel; label: string; icon: any }[] = [
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { value: "call", label: "Ligação", icon: Phone },
  { value: "instagram", label: "Instagram", icon: Instagram },
  { value: "email", label: "Email", icon: Mail },
  { value: "sms", label: "SMS", icon: MessageSquare },
];

const OUTCOMES: { value: FollowOutcome; label: string; color: string }[] = [
  { value: "no_response", label: "Sem resposta — avançar etapa", color: "text-muted-foreground" },
  { value: "responded", label: "Respondeu", color: "text-primary" },
  { value: "meeting", label: "Reunião agendada", color: "text-primary" },
  { value: "sale", label: "Venda fechada 🎉", color: "text-primary" },
  { value: "lost", label: "Perdido", color: "text-destructive" },
];

export function ExecutarFollowDialog({ open, onOpenChange, entry }: Props) {
  const [channel, setChannel] = useState<FollowChannel>("whatsapp");
  const [outcome, setOutcome] = useState<FollowOutcome>("no_response");
  const [notes, setNotes] = useState("");
  const { executeFollow } = useFollowUpEsteira();

  if (!entry) return null;

  const handleSubmit = async () => {
    await executeFollow.mutateAsync({
      entry_id: entry.id,
      channel,
      outcome,
      notes: notes || undefined,
    });
    setNotes("");
    setOutcome("no_response");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Executar Follow-up — {entry.contact_name || "Contato"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="mb-2 block">Canal usado</Label>
            <div className="grid grid-cols-5 gap-2">
              {CHANNELS.map((c) => {
                const Icon = c.icon;
                const active = channel === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setChannel(c.value)}
                    className={`flex flex-col items-center gap-1 rounded-md border p-2 text-xs transition ${
                      active ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Resultado</Label>
            <RadioGroup value={outcome} onValueChange={(v) => setOutcome(v as FollowOutcome)}>
              {OUTCOMES.map((o) => (
                <div key={o.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={o.value} id={o.value} />
                  <Label htmlFor={o.value} className={`cursor-pointer ${o.color}`}>{o.label}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div>
            <Label htmlFor="notes" className="mb-2 block">Observação (opcional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="O que foi dito? Próxima ação?"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={executeFollow.isPending}>
            {executeFollow.isPending ? "Salvando..." : "Registrar follow"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
