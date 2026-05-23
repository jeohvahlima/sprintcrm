import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import type { HunterStage, HunterLead } from "@/hooks/useHunterPipeline";

const STAGE_LABEL: Record<HunterStage, string> = {
  novo: "Leads Novos",
  tentativa_contato: "Tentativa de Contato",
  follow_up: "Follow-up",
  contato_realizado: "Contato Realizado",
  buscando_decisor: "Buscando Decisor",
  conversa_decisor: "Conversa com Decisor",
  oportunidade: "Oportunidade",
  descartado: "Descartado",
};

interface Props {
  open: boolean;
  lead: HunterLead;
  toStage: HunterStage;
  onCancel: () => void;
  onConfirm: (patch: Partial<HunterLead>) => void;
}

export function HunterStageForm({ open, lead, toStage, onCancel, onConfirm }: Props) {
  const [substatus, setSubstatus] = useState(lead.substatus ?? "");
  const [contactName, setContactName] = useState(lead.contact_person_name ?? "");
  const [nextAt, setNextAt] = useState(lead.next_action_at?.slice(0, 16) ?? "");
  const [reason, setReason] = useState(lead.next_action_reason ?? "");
  const [classificacao, setClassificacao] = useState<"A" | "B" | "C" | "">(lead.decisor_classificacao ?? "");
  const [dor, setDor] = useState(lead.dor_identificada ?? "");
  const [meetingAt, setMeetingAt] = useState(lead.meeting_at?.slice(0, 16) ?? "");
  const [discard, setDiscard] = useState(lead.discard_reason ?? "");
  const [meetingType, setMeetingType] = useState("Reunião agendada");

  const submit = () => {
    const patch: Partial<HunterLead> = {};
    switch (toStage) {
      case "tentativa_contato":
        if (!substatus) { alert("Selecione um substatus"); return; }
        patch.substatus = substatus;
        break;
      case "follow_up":
        if (!nextAt || !reason) { alert("Data e motivo são obrigatórios"); return; }
        patch.next_action_at = new Date(nextAt).toISOString();
        patch.next_action_reason = reason;
        break;
      case "contato_realizado":
        if (!substatus) { alert("Quem atendeu?"); return; }
        patch.substatus = substatus;
        patch.contact_person_name = contactName || null;
        break;
      case "buscando_decisor":
        patch.substatus = substatus || "buscando";
        patch.contact_person_name = contactName || null;
        break;
      case "conversa_decisor":
        if (!classificacao || !dor) { alert("Classificação e dor são obrigatórias"); return; }
        patch.decisor_classificacao = classificacao as "A" | "B" | "C";
        patch.dor_identificada = dor;
        break;
      case "oportunidade":
        if (!meetingAt) { alert("Data da reunião é obrigatória"); return; }
        patch.meeting_at = new Date(meetingAt).toISOString();
        patch.substatus = meetingType;
        break;
      case "descartado":
        if (!discard) { alert("Motivo do descarte é obrigatório"); return; }
        patch.discard_reason = discard;
        break;
    }
    onConfirm(patch);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mover para “{STAGE_LABEL[toStage]}”</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {toStage === "tentativa_contato" && (
            <div className="space-y-1.5">
              <Label>Substatus</Label>
              <Select value={substatus} onValueChange={setSubstatus}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nao_atendeu">Não atendeu</SelectItem>
                  <SelectItem value="ocupado">Ocupado</SelectItem>
                  <SelectItem value="caixa_postal">Caixa postal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {toStage === "follow_up" && (
            <>
              <div className="space-y-1.5">
                <Label>Próxima ligação</Label>
                <Input type="datetime-local" value={nextAt} onChange={(e) => setNextAt(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Motivo do retorno</Label>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
              </div>
            </>
          )}

          {toStage === "contato_realizado" && (
            <>
              <div className="space-y-1.5">
                <Label>Quem atendeu?</Label>
                <Select value={substatus} onValueChange={setSubstatus}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recepcao">Recepção</SelectItem>
                    <SelectItem value="comercial">Comercial</SelectItem>
                    <SelectItem value="financeiro">Financeiro</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Nome da pessoa</Label>
                <Input value={contactName} onChange={(e) => setContactName(e.target.value)} />
              </div>
            </>
          )}

          {toStage === "buscando_decisor" && (
            <>
              <div className="space-y-1.5">
                <Label>Ação rápida</Label>
                <Select value={substatus} onValueChange={setSubstatus}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp_decisor">Pegou WhatsApp</SelectItem>
                    <SelectItem value="email_decisor">Pegou e-mail</SelectItem>
                    <SelectItem value="transferencia">Pediu transferência</SelectItem>
                    <SelectItem value="retornar">Retornar depois</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Nome do decisor (se sabido)</Label>
                <Input value={contactName} onChange={(e) => setContactName(e.target.value)} />
              </div>
            </>
          )}

          {toStage === "conversa_decisor" && (
            <>
              <div className="space-y-1.5">
                <Label>Classificação</Label>
                <Select value={classificacao} onValueChange={(v) => setClassificacao(v as any)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">A — Desorganizado</SelectItem>
                    <SelectItem value="B">B — Intermediário</SelectItem>
                    <SelectItem value="C">C — Avançado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Dor identificada</Label>
                <Textarea value={dor} onChange={(e) => setDor(e.target.value)} rows={3} />
              </div>
            </>
          )}

          {toStage === "oportunidade" && (
            <>
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={meetingType} onValueChange={setMeetingType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Reunião agendada">Reunião agendada</SelectItem>
                    <SelectItem value="Diagnóstico marcado">Diagnóstico marcado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Data da reunião</Label>
                <Input type="datetime-local" value={meetingAt} onChange={(e) => setMeetingAt(e.target.value)} />
              </div>
            </>
          )}

          {toStage === "descartado" && (
            <div className="space-y-1.5">
              <Label>Motivo</Label>
              <Select value={discard} onValueChange={setDiscard}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="numero_invalido">Número inválido</SelectItem>
                  <SelectItem value="nao_icp">Não é ICP</SelectItem>
                  <SelectItem value="sem_interesse">Sem interesse</SelectItem>
                  <SelectItem value="ja_resolvido">Já resolvido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {toStage === "novo" && (
            <p className="text-sm text-muted-foreground">Volta para “Leads Novos”.</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button onClick={submit}>Confirmar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
