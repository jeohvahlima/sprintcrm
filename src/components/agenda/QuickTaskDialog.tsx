import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { criarTarefa, upsertCompromissoParaTarefa } from "@/services/tarefaService";
import { toast } from "sonner";
import { CheckCircle2, ChevronsUpDown, X } from "lucide-react";

interface QuickTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDueDate?: Date | null;
  defaultLeadId?: string | null;
  defaultLeadName?: string | null;
  onCreated?: () => void;
}

const toLocalInput = (d?: Date | null) => {
  if (!d) return "";
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
};

export function QuickTaskDialog({
  open,
  onOpenChange,
  defaultDueDate,
  defaultLeadId,
  defaultLeadName,
  onCreated,
}: QuickTaskDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"baixa" | "media" | "alta" | "urgente">("media");
  const [dueDate, setDueDate] = useState<string>("");
  const [leadId, setLeadId] = useState<string | null>(null);
  const [leadName, setLeadName] = useState<string>("");
  const [leadPickerOpen, setLeadPickerOpen] = useState(false);
  const [leads, setLeads] = useState<{ id: string; name: string }[]>([]);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setDescription("");
    setPriority("media");
    setDueDate(toLocalInput(defaultDueDate ?? null));
    setLeadId(defaultLeadId ?? null);
    setLeadName(defaultLeadName ?? "");
    setSearch("");
  }, [open, defaultDueDate, defaultLeadId, defaultLeadName]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase
        .from("leads")
        .select("id, name")
        .order("created_at", { ascending: false })
        .range(0, 199);
      setLeads(data || []);
    })();
  }, [open]);

  const filteredLeads = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return leads.slice(0, 50);
    return leads.filter((l) => l.name?.toLowerCase().includes(q)).slice(0, 50);
  }, [leads, search]);

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Informe o título da tarefa");
      return;
    }
    setSaving(true);
    try {
      const iso = dueDate ? new Date(dueDate).toISOString() : null;
      const { data, error } = await criarTarefa({
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        due_date: iso,
        lead_id: leadId || undefined,
      });
      if (error) throw error;
      const task = (data as any)?.task || (data as any)?.data || data;
      if (iso && task?.id) {
        await upsertCompromissoParaTarefa({
          id: task.id,
          title: title.trim(),
          due_date: iso,
          assignee_id: task.assignee_id ?? null,
        });
      }
      toast.success("Tarefa criada");
      onCreated?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Erro ao criar tarefa", { description: e?.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Nova tarefa
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Título *</Label>
            <Input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Ligar para João sobre proposta"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Data de entrega</Label>
              <Input
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Contato / Lead (opcional)</Label>
            <Popover open={leadPickerOpen} onOpenChange={setLeadPickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between">
                  <span className="truncate">{leadName || "Vincular contato"}</span>
                  {leadId ? (
                    <X
                      className="h-4 w-4 opacity-60 hover:opacity-100"
                      onClick={(e) => { e.stopPropagation(); setLeadId(null); setLeadName(""); }}
                    />
                  ) : (
                    <ChevronsUpDown className="h-4 w-4 opacity-50" />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput placeholder="Buscar contato..." value={search} onValueChange={setSearch} />
                  <CommandList>
                    <CommandEmpty>Nenhum contato encontrado</CommandEmpty>
                    <CommandGroup>
                      {filteredLeads.map((l) => (
                        <CommandItem
                          key={l.id}
                          value={l.id}
                          onSelect={() => {
                            setLeadId(l.id);
                            setLeadName(l.name);
                            setLeadPickerOpen(false);
                          }}
                        >
                          {l.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalhes opcionais"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || !title.trim()}>
            {saving ? "Criando..." : "Criar tarefa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
