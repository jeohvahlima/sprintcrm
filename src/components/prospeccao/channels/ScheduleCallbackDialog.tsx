import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { CalendarClock, UserPlus } from "lucide-react";

export interface ScheduleInfo {
  callback_at?: string | null; // ISO (opcional)
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
  if (!iso) return "";
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function ScheduleCallbackDialog({
  open, onOpenChange, initial, defaultContactName, defaultPhone, onSave,
}: Props) {
  // Modo: "responsavel" (só salva contato do responsável, sem data)
  //       "agendamento" (define data/horário de retorno)
  const [mode, setMode] = useState<"responsavel" | "agendamento">(
    initial?.callback_at ? "agendamento" : "responsavel"
  );
  const [callbackLocal, setCallbackLocal] = useState<string>(toLocalInputValue(initial?.callback_at));
  const [reason, setReason] = useState(initial?.reason || "");
  const [altName, setAltName] = useState(initial?.alt_contact?.name || "");
  const [altRole, setAltRole] = useState(initial?.alt_contact?.role || "");
  const [altPhone, setAltPhone] = useState(initial?.alt_contact?.phone || "");
  const [altEmail, setAltEmail] = useState(initial?.alt_contact?.email || "");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMode(initial?.callback_at ? "agendamento" : "responsavel");
    setCallbackLocal(toLocalInputValue(initial?.callback_at));
    setReason(initial?.reason || "");
    setAltName(initial?.alt_contact?.name || "");
    setAltRole(initial?.alt_contact?.role || "");
    setAltPhone(initial?.alt_contact?.phone || "");
    setAltEmail(initial?.alt_contact?.email || "");
    setNotes(initial?.notes || "");
  }, [open]);

  const hasAltContact = !!(altName.trim() || altPhone.trim() || altEmail.trim() || altRole.trim());
  const canSave =
    mode === "agendamento"
      ? !!callbackLocal
      : hasAltContact;

  async function handleSave() {
    setSaving(true);
    try {
      const iso = mode === "agendamento" && callbackLocal ? new Date(callbackLocal).toISOString() : null;
      const info: ScheduleInfo = {
        callback_at: iso,
        reason: reason.trim() || null,
        notes: notes.trim() || null,
        alt_contact: hasAltContact
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
            {mode === "agendamento" ? (
              <CalendarClock className="h-4 w-4 text-purple-600" />
            ) : (
              <UserPlus className="h-4 w-4 text-purple-600" />
            )}
            {mode === "agendamento" ? "Agendar retorno" : "Salvar contato do responsável"}
          </DialogTitle>
          <DialogDescription>
            {mode === "agendamento"
              ? "Defina o melhor dia e horário para retornar. Se for com outra pessoa (responsável, setor), preencha os dados abaixo."
              : "Quando a recepcionista/secretária passar o contato do responsável ou setor, salve aqui para contatar em outro momento — sem precisar marcar data."}
          </DialogDescription>
        </DialogHeader>

        {/* Seletor de modo */}
        <div className="flex items-center justify-between rounded-md border p-2 bg-muted/30">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={mode === "responsavel" ? "default" : "outline"}
              className={mode === "responsavel" ? "bg-purple-600 hover:bg-purple-700 h-7" : "h-7"}
              onClick={() => setMode("responsavel")}
            >
              <UserPlus className="h-3.5 w-3.5 mr-1" />
              Só contato do responsável
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "agendamento" ? "default" : "outline"}
              className={mode === "agendamento" ? "bg-purple-600 hover:bg-purple-700 h-7" : "h-7"}
              onClick={() => setMode("agendamento")}
            >
              <CalendarClock className="h-3.5 w-3.5 mr-1" />
              Agendar retorno
            </Button>
          </div>
        </div>

        <div className="space-y-4 py-2">
          {mode === "agendamento" && (
            <>
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
            </>
          )}

          <div className="rounded-md border p-3 space-y-3 bg-muted/30">
            <div>
              <Label className="text-sm font-medium">
                Contato do responsável {mode === "responsavel" ? "*" : "(opcional)"}
              </Label>
              <p className="text-xs text-muted-foreground">
                {mode === "responsavel"
                  ? "Preencha pelo menos um campo (nome, telefone ou e-mail) do responsável/setor passado pela recepção."
                  : "Use quando quem atendeu não é o decisor (recepcionista, secretária)."}
              </p>
            </div>

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
          </div>

          <div className="grid grid-cols-1 gap-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              rows={3}
              placeholder={
                mode === "responsavel"
                  ? "Ex.: Recepcionista informou que o responsável atende melhor pela manhã."
                  : "Detalhes adicionais sobre o agendamento..."
              }
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || !canSave} className="bg-purple-600 hover:bg-purple-700">
            {saving
              ? "Salvando..."
              : mode === "agendamento"
              ? "Confirmar agendamento"
              : "Salvar contato"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
