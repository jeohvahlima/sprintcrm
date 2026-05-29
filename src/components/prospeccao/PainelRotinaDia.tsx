import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  CheckCircle2, Clock, AlertTriangle, Siren, ListChecks, CalendarRange,
  Plus, Filter, Play, AlarmClock, User, Phone, MessageCircle, Database, Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Status = "pendente" | "em_andamento" | "concluida";
type Priority = "baixa" | "normal" | "media" | "alta" | "urgente";

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  status: Status;
  priority: Priority;
  due_date: string | null;
  assignee_id: string | null;
  created_at: string;
}

type Bucket = "urgent" | "late" | "pending" | "done";
type Filtro = "all" | Bucket;

function startOfDay(d = new Date()) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d = new Date()) { const x = new Date(d); x.setHours(23,59,59,999); return x; }
function fmtTime(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function classify(t: TaskRow): Bucket {
  if (t.status === "concluida") return "done";
  const now = Date.now();
  const due = t.due_date ? new Date(t.due_date).getTime() : null;
  if (due && due < startOfDay().getTime()) return "late";
  if (t.priority === "urgente") return "urgent";
  return "pending";
}

const BUCKET_META: Record<Bucket, { label: string; pillCls: string; iconCls: string; xp: number }> = {
  urgent:  { label: "Obrigação", pillCls: "bg-red-500/10 text-red-400 border-red-500/30", iconCls: "bg-red-500/10 text-red-400", xp: 50 },
  late:    { label: "Atrasada",  pillCls: "bg-orange-500/10 text-orange-400 border-orange-500/30", iconCls: "bg-orange-500/10 text-orange-400", xp: 25 },
  pending: { label: "Pendente",  pillCls: "bg-amber-500/10 text-amber-400 border-amber-500/30", iconCls: "bg-amber-500/10 text-amber-400", xp: 15 },
  done:    { label: "Concluída", pillCls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30", iconCls: "bg-emerald-500/10 text-emerald-400", xp: 20 },
};

export function PainelRotinaDia() {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>("all");

  const load = async () => {
    setLoading(true);
    const inicioSemana = new Date(); inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay() + 1); inicioSemana.setHours(0,0,0,0);
    const fimSemana = new Date(inicioSemana); fimSemana.setDate(fimSemana.getDate() + 7);
    const { data } = await supabase
      .from("tasks")
      .select("id, title, description, status, priority, due_date, assignee_id, created_at")
      .or(`due_date.gte.${inicioSemana.toISOString()},due_date.is.null`)
      .lte("due_date", fimSemana.toISOString())
      .order("due_date", { ascending: true, nullsFirst: false })
      .range(0, 199);
    setTasks((data || []) as any);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("rotina_dia_tasks")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const tasksHoje = useMemo(() => {
    const s = startOfDay().getTime(), e = endOfDay().getTime();
    return tasks.filter(t => {
      if (!t.due_date) return t.status !== "concluida";
      const d = new Date(t.due_date).getTime();
      return (d >= s && d <= e) || classify(t) === "late";
    });
  }, [tasks]);

  const counts = useMemo(() => {
    const c = { done: 0, pending: 0, late: 0, urgent: 0 };
    tasksHoje.forEach(t => { c[classify(t)]++; });
    return c;
  }, [tasksHoje]);

  const total = tasksHoje.length || 1;
  const filtradas = useMemo(() => {
    if (filtro === "all") return tasksHoje;
    return tasksHoje.filter(t => classify(t) === filtro);
  }, [tasksHoje, filtro]);

  const grupos: { key: Bucket; titulo: string; itens: TaskRow[] }[] = (
    [
      { key: "urgent",  titulo: "Obrigações · prazo crítico", itens: filtradas.filter(t => classify(t) === "urgent") },
      { key: "late",    titulo: "Atrasadas · ação imediata",  itens: filtradas.filter(t => classify(t) === "late") },
      { key: "pending", titulo: "Pendentes · hoje",            itens: filtradas.filter(t => classify(t) === "pending") },
      { key: "done",    titulo: "Concluídas hoje",             itens: filtradas.filter(t => classify(t) === "done") },
    ] as { key: Bucket; titulo: string; itens: TaskRow[] }[]
  ).filter(g => g.itens.length > 0);

  const toggleDone = async (t: TaskRow) => {
    const novo: Status = t.status === "concluida" ? "pendente" : "concluida";
    setTasks(prev => prev.map(x => x.id === t.id ? { ...x, status: novo } : x));
    await supabase.from("tasks").update({ status: novo }).eq("id", t.id);
  };

  // Calendário semanal
  const semana = useMemo(() => {
    const hoje = new Date();
    const seg = new Date(hoje); seg.setDate(seg.getDate() - ((hoje.getDay() + 6) % 7)); seg.setHours(0,0,0,0);
    const dias: { date: Date; isToday: boolean; isWeekend: boolean; tasks: TaskRow[] }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(seg); d.setDate(seg.getDate() + i);
      const ds = d.getTime(), de = ds + 86399999;
      const ts = tasks.filter(t => t.due_date && new Date(t.due_date).getTime() >= ds && new Date(t.due_date).getTime() <= de);
      dias.push({ date: d, isToday: d.toDateString() === hoje.toDateString(), isWeekend: d.getDay() === 0 || d.getDay() === 6, tasks: ts });
    }
    return dias;
  }, [tasks]);

  const metrics = [
    { label: "Concluídas", value: counts.done, color: "text-emerald-400", bar: "bg-emerald-500", sub: `${counts.done} de ${tasksHoje.length} hoje`, Icon: CheckCircle2 },
    { label: "Pendentes", value: counts.pending, color: "text-amber-400", bar: "bg-amber-500", sub: "Aguardando execução", Icon: Clock },
    { label: "Atrasadas", value: counts.late, color: "text-orange-400", bar: "bg-orange-500", sub: "Precisam de atenção", Icon: AlertTriangle },
    { label: "Obrigações", value: counts.urgent, color: "text-red-400", bar: "bg-red-500", sub: "Prazo crítico hoje", Icon: Siren },
  ];

  const filtros: { id: Filtro; label: string; cls: string; Icon: any }[] = [
    { id: "all", label: "Todos", cls: "data-[on=true]:bg-primary data-[on=true]:text-primary-foreground data-[on=true]:border-primary", Icon: ListChecks },
    { id: "pending", label: "Pendentes", cls: "data-[on=true]:bg-amber-500/10 data-[on=true]:text-amber-400 data-[on=true]:border-amber-500", Icon: Clock },
    { id: "urgent", label: "Obrigações", cls: "data-[on=true]:bg-red-500/10 data-[on=true]:text-red-400 data-[on=true]:border-red-500", Icon: AlertTriangle },
    { id: "late", label: "Atrasadas", cls: "data-[on=true]:bg-orange-500/10 data-[on=true]:text-orange-400 data-[on=true]:border-orange-500", Icon: AlarmClock },
    { id: "done", label: "Concluídas", cls: "data-[on=true]:bg-emerald-500/10 data-[on=true]:text-emerald-400 data-[on=true]:border-emerald-500", Icon: CheckCircle2 },
  ];

  return (
    <section className="space-y-4 animate-fade-in">
      {/* Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {metrics.map(m => {
          const pct = Math.min(100, Math.round((m.value / total) * 100));
          return (
            <Card key={m.label} className="p-4 bg-card border-border/60">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                <m.Icon className={cn("h-3 w-3", m.color)} />
                {m.label}
              </div>
              <div className={cn("text-3xl font-medium leading-none", m.color)}>{m.value}</div>
              <div className="h-[3px] bg-muted rounded mt-2 overflow-hidden">
                <div className={cn("h-full rounded", m.bar)} style={{ width: `${pct}%` }} />
              </div>
              <div className="text-xs text-muted-foreground mt-1.5">{m.sub}</div>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr] gap-3">
        {/* Lista de tarefas */}
        <Card className="bg-card border-border/60 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ListChecks className="h-4 w-4 text-primary" /> Tarefas do dia
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{tasksHoje.length} total</span>
              <Button size="sm" variant="ghost" className="h-7 px-2"><Filter className="h-3.5 w-3.5" /></Button>
            </div>
          </div>

          <div className="flex gap-1.5 px-3 py-2.5 border-b border-border/60 overflow-x-auto">
            {filtros.map(f => (
              <button
                key={f.id}
                data-on={filtro === f.id}
                onClick={() => setFiltro(f.id)}
                className={cn(
                  "text-xs px-2.5 py-1 rounded-full border border-border text-muted-foreground transition-colors whitespace-nowrap flex items-center gap-1",
                  f.cls
                )}
              >
                <f.Icon className="h-3 w-3" /> {f.label}
              </button>
            ))}
          </div>

          <div className="p-3 space-y-1.5 max-h-[600px] overflow-y-auto">
            {loading && <div className="text-center py-8 text-xs text-muted-foreground">Carregando…</div>}
            {!loading && grupos.length === 0 && (
              <div className="text-center py-10 text-sm text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
                Nenhuma tarefa nesse filtro
              </div>
            )}
            {grupos.map(g => {
              const meta = BUCKET_META[g.key];
              return (
                <div key={g.key} className="space-y-1.5">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-1 pt-2 pb-0.5 font-medium flex items-center gap-1.5">
                    <span className={cn("h-2 w-2 rounded-sm", meta.iconCls)} />
                    {g.titulo}
                  </div>
                  {g.itens.map(t => {
                    const bucket = classify(t);
                    const bm = BUCKET_META[bucket];
                    const isDone = bucket === "done";
                    const borderCls =
                      bucket === "urgent" ? "border-red-500/40 bg-red-500/5" :
                      bucket === "late"   ? "border-orange-500/40 bg-orange-500/5" :
                      "border-border";
                    return (
                      <button
                        key={t.id}
                        onClick={() => toggleDone(t)}
                        className={cn(
                          "w-full flex items-start gap-2.5 p-2.5 rounded-lg bg-background/50 border text-left transition-colors hover:border-primary/40",
                          borderCls,
                          isDone && "opacity-60"
                        )}
                      >
                        <div className={cn("w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0", bm.iconCls)}>
                          {bucket === "done" ? <CheckCircle2 className="h-3.5 w-3.5" />
                            : bucket === "urgent" ? <Siren className="h-3.5 w-3.5" />
                            : bucket === "late" ? <AlarmClock className="h-3.5 w-3.5" />
                            : <Play className="h-3.5 w-3.5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={cn("text-xs font-medium text-foreground truncate", isDone && "line-through text-muted-foreground")}>
                            {t.title}
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />
                              {t.due_date ? `${new Date(t.due_date).toLocaleDateString("pt-BR")} ${fmtTime(t.due_date)}` : "Sem prazo"}
                            </span>
                            {t.assignee_id && <span className="flex items-center gap-1"><User className="h-3 w-3" />Responsável</span>}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full border", bm.pillCls)}>
                            {bm.label}
                          </span>
                          <span className="text-[10px] font-semibold text-primary">+{bm.xp}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </Card>

        {/* Calendário semanal */}
        <Card className="bg-card border-border/60 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
            <div className="flex items-center gap-2 text-sm font-medium">
              <CalendarRange className="h-4 w-4 text-primary" /> Calendário semanal
            </div>
            <div className="text-xs text-muted-foreground">
              {semana[0].date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} —{" "}
              {semana[6].date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
            </div>
          </div>

          <div className="grid grid-cols-7 border-b border-border/60">
            {semana.map((d, i) => (
              <div key={i} className="text-center p-2 border-r border-border/60 last:border-r-0">
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
                  {d.date.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}
                </div>
                <div className={cn("text-base font-medium mt-0.5",
                  d.isToday ? "text-primary" : d.isWeekend ? "text-muted-foreground/50" : "text-foreground/70"
                )}>
                  {d.date.getDate()}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 min-h-[280px]">
            {semana.map((d, i) => (
              <div
                key={i}
                className={cn(
                  "border-r border-border/60 last:border-r-0 p-1.5 space-y-1",
                  d.isToday && "bg-primary/5",
                  d.isWeekend && "opacity-50"
                )}
              >
                {d.tasks.slice(0, 6).map(t => {
                  const b = classify(t);
                  const cls =
                    b === "urgent" ? "bg-red-500/10 text-red-400 border-red-500/30" :
                    b === "late" ? "bg-orange-500/10 text-orange-400 border-orange-500/30" :
                    b === "done" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" :
                    "bg-amber-500/10 text-amber-400 border-amber-500/30";
                  return (
                    <div key={t.id} className={cn("text-[10px] leading-tight rounded px-1.5 py-1 border truncate", cls)}>
                      <div className="opacity-70 text-[9px]">{fmtTime(t.due_date)}</div>
                      <div className="truncate font-medium">{t.title}</div>
                    </div>
                  );
                })}
                {d.tasks.length === 0 && (
                  <div className="text-[10px] text-muted-foreground/50 text-center pt-3">—</div>
                )}
                {d.tasks.length > 6 && (
                  <div className="text-[9px] text-muted-foreground text-center">+{d.tasks.length - 6}</div>
                )}
              </div>
            ))}
          </div>

          <div className="text-center text-xs text-muted-foreground/60 italic py-3 border-t border-border/60">
            "Consistência gera previsibilidade. Sem volume, não existe venda."
          </div>
        </Card>
      </div>
    </section>
  );
}
