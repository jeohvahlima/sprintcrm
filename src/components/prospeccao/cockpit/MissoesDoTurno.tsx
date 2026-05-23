import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Check, Sunrise, Sun, Moon, Plus, Loader2, Sparkles } from "lucide-react";
import { useDailyMissions, currentShift, type Shift, type MissionWithProgress } from "@/hooks/useDailyCockpit";
import { usePlayerProfile } from "@/hooks/usePlayerProfile";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const SHIFT_META: Record<Shift, { label: string; Icon: any; tint: string }> = {
  manha: { label: "Manhã", Icon: Sunrise, tint: "text-amber-300" },
  tarde: { label: "Tarde", Icon: Sun, tint: "text-orange-300" },
  noite: { label: "Noite", Icon: Moon, tint: "text-indigo-300" },
};

const PRESETS: Array<Omit<MissionWithProgress, "id" | "active" | "progress">> = [
  { title: "Kickoff do dia (3 objetivos)", description: "Definir foco da manhã", role_target: null, shift: "manha", weekday: null, xp_reward: 30, icon: "sun" },
  { title: "Revisar leads prioritários", description: "Top 10 leads quentes", role_target: "sdr", shift: "manha", weekday: null, xp_reward: 20, icon: "target" },
  { title: "18 abordagens", description: "Bloco de prospecção forte", role_target: "sdr", shift: "tarde", weekday: null, xp_reward: 50, icon: "phone" },
  { title: "Atualizar CRM", description: "Não deixar lead sem registro", role_target: null, shift: "tarde", weekday: null, xp_reward: 15, icon: "database" },
  { title: "Escutar 1 call gravada", description: "Aprender com a equipe", role_target: null, shift: "noite", weekday: null, xp_reward: 20, icon: "headphones" },
  { title: "Follow-up dos atrasados", description: "Zerar pendências", role_target: "closer", shift: "tarde", weekday: null, xp_reward: 25, icon: "check" },
];

export function MissoesDoTurno() {
  const { data = [], complete, reopen, isLoading, refetch } = useDailyMissions();
  const { companyId } = usePlayerProfile();
  const { isAdmin, userRoles } = usePermissions();
  const canManage = isAdmin || userRoles.some((r) => r.role === "gestor");
  const [openDialog, setOpenDialog] = useState(false);

  const grouped = useMemo(() => {
    const g: Record<Shift, MissionWithProgress[]> = { manha: [], tarde: [], noite: [] };
    data.forEach((m) => g[m.shift]?.push(m));
    return g;
  }, [data]);

  const cur = currentShift();
  const totalDone = data.filter((m) => m.progress?.status === "done").length;
  const totalXp = data
    .filter((m) => m.progress?.status === "done")
    .reduce((s, m) => s + (m.progress?.xp_awarded || m.xp_reward), 0);

  const seedPresets = async () => {
    if (!companyId) return;
    const rows = PRESETS.map((p) => ({ ...p, company_id: companyId, active: true }));
    const { error } = await supabase.from("daily_missions").insert(rows);
    if (error) toast.error("Falha ao criar missões");
    else {
      toast.success(`${PRESETS.length} missões padrão criadas`);
      refetch();
    }
  };

  return (
    <>
      <Card className="p-4 md:p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Missões do Dia
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {totalDone}/{data.length} concluídas · {totalXp} XP ganho hoje
            </p>
          </div>
          {canManage && (
            <div className="flex gap-1.5">
              {data.length === 0 && (
                <Button size="sm" variant="outline" onClick={seedPresets}>
                  <Sparkles className="h-3.5 w-3.5 mr-1" /> Usar presets
                </Button>
              )}
              <Button size="sm" variant="default" onClick={() => setOpenDialog(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Missão
              </Button>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-6 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Nenhuma missão configurada ainda.
            {canManage && (
              <div className="mt-2">
                <Button size="sm" variant="outline" onClick={seedPresets}>
                  Criar missões padrão
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(Object.keys(SHIFT_META) as Shift[]).map((shift) => {
              const meta = SHIFT_META[shift];
              const items = grouped[shift];
              const isCur = shift === cur;
              return (
                <div
                  key={shift}
                  className={cn(
                    "rounded-lg border p-3 space-y-2",
                    isCur ? "border-primary/40 bg-primary/5" : "border-border/40 bg-muted/20"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <meta.Icon className={cn("h-4 w-4", meta.tint)} />
                    <span className="text-xs font-semibold uppercase tracking-wider">
                      {meta.label}
                    </span>
                    {isCur && (
                      <Badge variant="default" className="ml-auto text-[10px] h-4">
                        Agora
                      </Badge>
                    )}
                  </div>
                  {items.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground italic">Sem missões</p>
                  ) : (
                    items.map((m) => {
                      const done = m.progress?.status === "done";
                      return (
                        <button
                          key={m.id}
                          onClick={() =>
                            done ? reopen.mutate(m.id) : complete.mutate(m.id)
                          }
                          className={cn(
                            "w-full text-left p-2 rounded-md border transition-all group",
                            done
                              ? "bg-primary/10 border-primary/30"
                              : "bg-card border-border/40 hover:border-primary/40 hover:bg-primary/5"
                          )}
                        >
                          <div className="flex items-start gap-2">
                            <div
                              className={cn(
                                "shrink-0 mt-0.5 h-4 w-4 rounded border flex items-center justify-center transition-all",
                                done
                                  ? "bg-primary border-primary"
                                  : "border-muted-foreground/40 group-hover:border-primary"
                              )}
                            >
                              {done && <Check className="h-3 w-3 text-primary-foreground" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div
                                className={cn(
                                  "text-xs font-medium leading-tight",
                                  done && "line-through opacity-70"
                                )}
                              >
                                {m.title}
                              </div>
                              {m.description && (
                                <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                                  {m.description}
                                </div>
                              )}
                            </div>
                            <Badge
                              variant="outline"
                              className="text-[10px] h-4 shrink-0 border-primary/40 text-primary"
                            >
                              +{m.xp_reward}
                            </Badge>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <CreateMissionDialog
        open={openDialog}
        onOpenChange={setOpenDialog}
        companyId={companyId}
        onCreated={() => refetch()}
      />
    </>
  );
}

function CreateMissionDialog({
  open,
  onOpenChange,
  companyId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  companyId: string | null;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [shift, setShift] = useState<Shift>("manha");
  const [role, setRole] = useState<string>("all");
  const [xp, setXp] = useState(25);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!title.trim() || !companyId) return;
    setSaving(true);
    const { error } = await supabase.from("daily_missions").insert({
      company_id: companyId,
      title: title.trim(),
      description: description.trim() || null,
      shift,
      role_target: role === "all" ? null : role,
      xp_reward: xp,
      active: true,
    });
    setSaving(false);
    if (error) {
      toast.error("Falha ao criar missão");
      return;
    }
    toast.success("Missão criada");
    setTitle("");
    setDescription("");
    setXp(25);
    onCreated();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova missão diária</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label className="text-xs">Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Fazer 20 ligações" />
          </div>
          <div>
            <Label className="text-xs">Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Turno</Label>
              <Select value={shift} onValueChange={(v) => setShift(v as Shift)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manha">Manhã</SelectItem>
                  <SelectItem value="tarde">Tarde</SelectItem>
                  <SelectItem value="noite">Noite</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Papel</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="sdr">SDR</SelectItem>
                  <SelectItem value="closer">Closer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">XP</Label>
              <Input type="number" min={1} value={xp} onChange={(e) => setXp(Number(e.target.value))} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving || !title.trim()}>Criar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
