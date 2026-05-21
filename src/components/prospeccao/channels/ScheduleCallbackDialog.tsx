import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { CalendarClock } from "lucide-react";

export interface ScheduleInfo {
  callback_at?: string | null; // ISO
  reason?: string | null;
  alt_contact?: {
    name?: string | null;
    role?: string | null;     // setor / cargo
    phone?: string | null;
    email?: string | null;
  } | null;
  notes?: string | null;
  created_at?: string;
  created_by?: { id?: string | null; name?: string | null } | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: ScheduleInfo | null;
  defaultContactName?: string | null;
  defaultPhone?: string | null;
  onSave: (info: ScheduleInfo) => Promise<void> | void;
}

function toLocalInputValue(iso?: string | null) {
  if (!iso) {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    d.setHours(d.getHours() + 1, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  }
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function ScheduleCallbackDialog({
  open, onOpenChange, initial, defaultContactName, defaultPhone, onSave,
}: Props) {
  const [callbackLocal, setCallbackLocal] = useState<string>(toLocalInputValue(initial?.callback_at));
  const [reason, setReason] = useState(initial?.reason || "");
  const [useAlt, setUseAlt] = useState<boolean>(!!initial?.alt_contact?.name || !!initial?.alt_contact?.phone || !!initial?.alt_contact?.email);
  const [altName, setAltName] = useState(initial?.alt_contact?.name || "");
  const [altRole, setAltRole] = useState(initial?.alt_contact?.role || "");
  const [altPhone, setAltPhone] = useState(initial?.alt_contact?.phone || "");
  const [altEmail, setAltEmail] = useState(initial?.alt_contact?.email || "");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCallbackLocal(toLocalInputValue(initial?.callback_at));
    setReason(initial?.reason || "");
    const hasAlt = !!initial?.alt_contact?.name || !!initial?.alt_contact?.phone || !!initial?.alt_contact?.email;
    setUseAlt(hasAlt);
    setAltName(initial?.alt_contact?.name || "");
    setAltRole(initial?.alt_contact?.role || "");
    setAltPhone(initial?.alt_contact?.phone || "");
    setAltEmail(initial?.alt_contact?.email || "");
    setNotes(initial?.notes || "");
  }, [open]);

  async function handleSave() {
    setSaving(true);
    try {
      const iso = callbackLocal ? new Date(callbackLocal).toISOString() : null;
      const info: ScheduleInfo = {
        callback_at: iso,
        reason: reason.trim() || null,
        notes: notes.trim() || null,
        alt_contact: useAlt
          ? {
              name: altName.trim() || null,
              role: altRole.trim() || null,
              phone: altPhone.trim() || null,
              email: altEmail.trim() || null,
            }
          : null,
      };
      await onSave(info);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-purple-600" />
            Agendar retorno
          </DialogTitle>
          <DialogDescription>
            Defina o melhor dia e horário para retornar a ligação. Se o retorno for com outra pessoa (responsável, setor, gerente), preencha os dados do contato alternativo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 gap-2">
            <Label htmlFor="callback-at">Data e horário do retorno *</Label>
            <Input
              id="callback-at"
              type="datetime-local"
              value={callbackLocal}
              onChange={(e) => setCallbackLocal(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-2">
            <Label htmlFor="reason">Motivo do retorno</Label>
            <Input
              id="reason"
              placeholder='Ex.: "Recepcionista pediu para ligar depois das 14h"'
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div className="rounded-md border p-3 space-y-3 bg-muted/30">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="use-alt" className="text-sm font-medium">Retornar para outro contato</Label>
                <p className="text-xs text-muted-foreground">
                  Use quando quem atendeu não é o decisor (recepcionista, secretária, etc).
                </p>
              </div>
              <Switch id="use-alt" checked={useAlt} onCheckedChange={setUseAlt} />
            </div>

            {useAlt && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <Label htmlFor="alt-name" className="text-xs">Nome do responsável</Label>
                  <Input id="alt-name" value={altName} onChange={(e) => setAltName(e.target.value)} placeholder="Ex.: João Silva" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="alt-role" className="text-xs">Cargo / Setor</Label>
                  <Input id="alt-role" value={altRole} onChange={(e) => setAltRole(e.target.value)} placeholder="Ex.: Gerente Comercial" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="alt-phone" className="text-xs">Telefone</Label>
                  <Input id="alt-phone" value={altPhone} onChange={(e) => setAltPhone(e.target.value)} placeholder="(00) 00000-0000" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="alt-email" className="text-xs">E-mail</Label>
                  <Input id="alt-email" type="email" value={altEmail} onChange={(e) => setAltEmail(e.target.value)} placeholder="responsavel@empresa.com" />
                </div>
                {(defaultContactName || defaultPhone) && (
                  <p className="sm:col-span-2 text-[10px] text-muted-foreground">
                    Contato original: <strong>{defaultContactName || "—"}</strong>
                    {defaultPhone ? ` · ${defaultPhone}` : ""}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              rows={3}
              placeholder="Detalhes adicionais sobre o agendamento..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || !callbackLocal} className="bg-purple-600 hover:bg-purple-700">
            {saving ? "Salvando..." : "Confirmar agendamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
