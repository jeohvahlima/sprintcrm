import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCompanyClosers, useCreateHandoff } from "@/hooks/useHandoffs";
import { toast } from "sonner";
import { ArrowRightLeft } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  leadId: string;
  leadName?: string;
}

export function HandoffDialog({ open, onOpenChange, leadId, leadName }: Props) {
  const { data: closers = [] } = useCompanyClosers();
  const createHandoff = useCreateHandoff();

  const [closerId, setCloserId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [scheduledAt, setScheduledAt] = useState<string>("");
  const [expectedValue, setExpectedValue] = useState<string>("");
  const [score, setScore] = useState<string>("8");

  const handleSubmit = async () => {
    try {
      await createHandoff.mutateAsync({
        lead_id: leadId,
        closer_id: closerId || null,
        sdr_notes: notes,
        scheduled_meeting_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        expected_value: expectedValue ? Number(expectedValue) : 0,
        qualification_score: Number(score),
      });
      toast.success(closerId ? "Lead transferido para o Closer 🚀" : "Lead disponibilizado para o time de Closers");
      onOpenChange(false);
      setNotes(""); setScheduledAt(""); setExpectedValue(""); setCloserId("");
    } catch (e: any) {
      toast.error(e.message || "Erro ao criar handoff");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            Passar para Closer
          </DialogTitle>
          {leadName && <p className="text-sm text-muted-foreground">Lead: <strong>{leadName}</strong></p>}
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label>Closer responsável (opcional)</Label>
            <Select value={closerId} onValueChange={setCloserId}>
              <SelectTrigger><SelectValue placeholder="Distribuir para qualquer Closer disponível" /></SelectTrigger>
              <SelectContent>
                {closers.length === 0 ? (
                  <div className="px-2 py-3 text-sm text-muted-foreground">Nenhum Closer cadastrado</div>
                ) : closers.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.full_name || c.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Reunião agendada para</Label>
              <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
            </div>
            <div>
              <Label>Valor previsto (R$)</Label>
              <Input type="number" min="0" step="100" value={expectedValue} onChange={(e) => setExpectedValue(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Score de qualificação (1-10)</Label>
            <Input type="number" min="1" max="10" value={score} onChange={(e) => setScore(e.target.value)} />
          </div>

          <div>
            <Label>Notas para o Closer</Label>
            <Textarea
              rows={4}
              placeholder="Ex: Lead já demonstrou interesse no plano Pro, decisor confirmado, orçamento aprovado, próximo passo é fechar a proposta..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={createHandoff.isPending}>
            {createHandoff.isPending ? "Transferindo..." : "Transferir Lead"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
