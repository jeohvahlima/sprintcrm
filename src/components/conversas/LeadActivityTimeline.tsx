import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  History,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  UserPlus,
  Tag as TagIcon,
  DollarSign,
  TrendingUp,
  ArrowRight,
  CalendarClock,
  CheckSquare,
  PhoneCall,
  PhoneOff,
  GitBranch,
  Percent,
} from "lucide-react";

interface Props {
  leadId?: string | null;
  leadCreatedAt?: string | null;
  leadName?: string | null;
}

type EventType =
  | "lead_created"
  | "value"
  | "status"
  | "stage"
  | "probability"
  | "tag_added"
  | "tag_removed"
  | "task"
  | "appointment"
  | "attendance_started"
  | "attendance_finished";

interface TimelineEvent {
  id: string;
  type: EventType;
  at: string;
  title: string;
  description?: string;
  userName?: string;
}

const TYPE_META: Record<EventType, { icon: any; color: string; label: string }> = {
  lead_created: { icon: UserPlus, color: "text-primary", label: "Lead criado" },
  value: { icon: DollarSign, color: "text-success", label: "Valor" },
  status: { icon: TrendingUp, color: "text-blue-500", label: "Status" },
  stage: { icon: GitBranch, color: "text-orange-500", label: "Etapa/Funil" },
  probability: { icon: Percent, color: "text-purple-500", label: "Probabilidade" },
  tag_added: { icon: TagIcon, color: "text-emerald-500", label: "Tag adicionada" },
  tag_removed: { icon: TagIcon, color: "text-red-500", label: "Tag removida" },
  task: { icon: CheckSquare, color: "text-indigo-500", label: "Tarefa" },
  appointment: { icon: CalendarClock, color: "text-cyan-500", label: "Agendamento" },
  attendance_started: { icon: PhoneCall, color: "text-green-500", label: "Atendimento iniciado" },
  attendance_finished: { icon: PhoneOff, color: "text-muted-foreground", label: "Atendimento finalizado" },
};

const fmtCurrency = (v: number | null | undefined) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function LeadActivityTimeline({ leadId, leadCreatedAt, leadName }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<TimelineEvent[]>([]);

  const load = async () => {
    if (!leadId) return;
    setLoading(true);
    try {
      const [valuesRes, tagsRes, tasksRes, comprRes, protocolsRes, leadRes] = await Promise.all([
        supabase.from("lead_value_history").select("*").eq("lead_id", leadId).order("created_at", { ascending: false }),
        supabase.from("lead_tag_history").select("*").eq("lead_id", leadId).order("created_at", { ascending: false }),
        supabase.from("tasks").select("id,title,status,created_at,assigned_to").eq("lead_id", leadId).order("created_at", { ascending: false }),
        supabase.from("compromissos").select("id,titulo,tipo_servico,status,data_hora_inicio,created_at,usuario_responsavel_id").eq("lead_id", leadId).order("created_at", { ascending: false }),
        supabase.from("attendance_protocols").select("id,protocol_number,status,started_at,finished_at,attending_user_name,attending_user_id").eq("lead_id", leadId).order("started_at", { ascending: false }),
        supabase.from("leads").select("id,name,created_at,responsavel_id").eq("id", leadId).maybeSingle(),
      ]);

      // Collect user IDs / etapa IDs / funil IDs to resolve names
      const userIds = new Set<string>();
      const etapaIds = new Set<string>();
      (valuesRes.data || []).forEach((r: any) => {
        if (r.changed_by) userIds.add(r.changed_by);
        if (r.old_etapa_id) etapaIds.add(r.old_etapa_id);
        if (r.new_etapa_id) etapaIds.add(r.new_etapa_id);
      });
      (tagsRes.data || []).forEach((r: any) => r.created_by && userIds.add(r.created_by));
      (tasksRes.data || []).forEach((r: any) => r.assigned_to && userIds.add(r.assigned_to));
      (comprRes.data || []).forEach((r: any) => r.usuario_responsavel_id && userIds.add(r.usuario_responsavel_id));
      (protocolsRes.data || []).forEach((r: any) => r.attending_user_id && userIds.add(r.attending_user_id));
      if (leadRes.data?.responsavel_id) userIds.add(leadRes.data.responsavel_id);
      if (leadRes.data?.responsavel_id) userIds.add(leadRes.data.responsavel_id);

      const [profilesRes, etapasRes] = await Promise.all([
        userIds.size
          ? supabase.from("profiles").select("id,full_name,email").in("id", Array.from(userIds))
          : Promise.resolve({ data: [] as any[] }),
        etapaIds.size
          ? supabase.from("etapas").select("id,nome,funil_id,funis(nome)").in("id", Array.from(etapaIds))
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const userMap: Record<string, string> = {};
      (profilesRes.data || []).forEach((p: any) => (userMap[p.id] = p.full_name || p.email || "Usuário"));
      const etapaMap: Record<string, { nome: string; funil?: string }> = {};
      (etapasRes.data || []).forEach((e: any) => (etapaMap[e.id] = { nome: e.nome, funil: e.funis?.nome }));

      const all: TimelineEvent[] = [];

      // Lead creation
      const createdAt = leadRes.data?.created_at || leadCreatedAt;
      if (createdAt) {
        all.push({
          id: `lead-${leadId}`,
          type: "lead_created",
          at: createdAt,
          title: "Lead criado",
          description: leadName ? `Contato: ${leadName}` : undefined,
          userName: leadRes.data?.responsavel_id ? userMap[leadRes.data.responsavel_id] : undefined,
        });
      }

      // Value history
      (valuesRes.data || []).forEach((r: any) => {
        if (r.change_type === "value_change") {
          all.push({
            id: `v-${r.id}`,
            type: "value",
            at: r.created_at,
            title: "Valor alterado",
            description: `${fmtCurrency(r.old_value)} → ${fmtCurrency(r.new_value)}`,
            userName: r.changed_by ? userMap[r.changed_by] : undefined,
          });
        } else if (r.change_type === "status_change") {
          all.push({
            id: `v-${r.id}`,
            type: "status",
            at: r.created_at,
            title: "Status alterado",
            description: `${r.old_status || "—"} → ${r.new_status || "—"}`,
            userName: r.changed_by ? userMap[r.changed_by] : undefined,
          });
        } else if (r.change_type === "stage_change") {
          const oldE = r.old_etapa_id ? etapaMap[r.old_etapa_id] : undefined;
          const newE = r.new_etapa_id ? etapaMap[r.new_etapa_id] : undefined;
          const oldLabel = oldE ? `${oldE.funil ? oldE.funil + " / " : ""}${oldE.nome}` : "—";
          const newLabel = newE ? `${newE.funil ? newE.funil + " / " : ""}${newE.nome}` : "—";
          all.push({
            id: `v-${r.id}`,
            type: "stage",
            at: r.created_at,
            title: "Movido no funil",
            description: `${oldLabel} → ${newLabel}`,
            userName: r.changed_by ? userMap[r.changed_by] : undefined,
          });
        } else if (r.change_type === "probability_change") {
          all.push({
            id: `v-${r.id}`,
            type: "probability",
            at: r.created_at,
            title: "Probabilidade alterada",
            description: r.notes || undefined,
            userName: r.changed_by ? userMap[r.changed_by] : undefined,
          });
        } else if (r.change_type === "initial") {
          const newE = r.new_etapa_id ? etapaMap[r.new_etapa_id] : undefined;
          all.push({
            id: `v-${r.id}`,
            type: "stage",
            at: r.created_at,
            title: "Adicionado ao funil",
            description: newE ? `${newE.funil ? newE.funil + " / " : ""}${newE.nome}` : undefined,
            userName: r.changed_by ? userMap[r.changed_by] : undefined,
          });
        }
      });

      // Tags
      (tagsRes.data || []).forEach((r: any) => {
        all.push({
          id: `t-${r.id}`,
          type: r.action === "added" ? "tag_added" : "tag_removed",
          at: r.created_at,
          title: r.action === "added" ? "Tag adicionada" : "Tag removida",
          description: r.tag_name,
          userName: r.created_by ? userMap[r.created_by] : undefined,
        });
      });

      // Tasks
      (tasksRes.data || []).forEach((r: any) => {
        all.push({
          id: `task-${r.id}`,
          type: "task",
          at: r.created_at,
          title: `Tarefa: ${r.title}`,
          description: `Status: ${r.status}`,
          userName: r.assigned_to ? userMap[r.assigned_to] : undefined,
        });
      });

      // Compromissos
      (comprRes.data || []).forEach((r: any) => {
        const when = r.data_hora_inicio
          ? format(new Date(r.data_hora_inicio), "dd/MM HH:mm", { locale: ptBR })
          : "";
        all.push({
          id: `appt-${r.id}`,
          type: "appointment",
          at: r.created_at,
          title: `Agendamento: ${r.titulo || r.tipo_servico}`,
          description: `${when}${r.status ? " • " + r.status : ""}`,
          userName: r.usuario_responsavel_id ? userMap[r.usuario_responsavel_id] : undefined,
        });
      });

      // Attendance protocols
      (protocolsRes.data || []).forEach((r: any) => {
        all.push({
          id: `att-s-${r.id}`,
          type: "attendance_started",
          at: r.started_at,
          title: `Atendimento iniciado`,
          description: r.protocol_number,
          userName: r.attending_user_name || (r.attending_user_id ? userMap[r.attending_user_id] : undefined),
        });
        if (r.finished_at) {
          all.push({
            id: `att-f-${r.id}`,
            type: "attendance_finished",
            at: r.finished_at,
            title: `Atendimento finalizado`,
            description: r.protocol_number,
            userName: r.attending_user_name || (r.attending_user_id ? userMap[r.attending_user_id] : undefined),
          });
        }
      });

      all.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
      setEvents(all);
    } catch (err) {
      console.error("[LeadActivityTimeline] erro:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && leadId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, leadId]);

  // Realtime subscription while open
  useEffect(() => {
    if (!open || !leadId) return;
    const ch = supabase
      .channel(`lead-timeline-${leadId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "lead_value_history", filter: `lead_id=eq.${leadId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "lead_tag_history", filter: `lead_id=eq.${leadId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: `lead_id=eq.${leadId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "compromissos", filter: `lead_id=eq.${leadId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance_protocols", filter: `lead_id=eq.${leadId}` }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, leadId]);

  const count = events.length;

  return (
    <div className="border rounded-lg bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/50 rounded-t-lg"
      >
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm text-foreground">Histórico do Lead</span>
          {open && count > 0 && (
            <Badge variant="secondary" className="h-5 text-xs">
              {count}
            </Badge>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="border-t">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-xs text-muted-foreground">
              {leadId ? "Atividades do contato em tempo real" : "Vincule um lead para ver o histórico"}
            </span>
            <Button variant="ghost" size="sm" onClick={load} disabled={loading || !leadId} className="h-7 px-2">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {!leadId ? (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              Este contato ainda não está vinculado a um lead.
            </div>
          ) : loading && events.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">Carregando...</div>
          ) : events.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              Nenhuma atividade registrada ainda.
            </div>
          ) : (
            <ScrollArea className="h-[360px]">
              <div className="relative px-3 py-2">
                <div className="absolute left-[22px] top-2 bottom-2 w-px bg-border" />
                <div className="space-y-3">
                  {events.map((e) => {
                    const meta = TYPE_META[e.type];
                    const Icon = meta.icon;
                    return (
                      <div key={e.id} className="relative pl-9">
                        <div className={`absolute left-0 top-0.5 w-5 h-5 rounded-full bg-background border-2 border-border flex items-center justify-center`}>
                          <Icon className={`h-3 w-3 ${meta.color}`} />
                        </div>
                        <div className="bg-muted/30 rounded-md px-2 py-1.5 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-foreground">{e.title}</span>
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                              {format(new Date(e.at), "dd/MM HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                          {e.description && (
                            <p className="text-muted-foreground mt-0.5 break-words">{e.description}</p>
                          )}
                          {e.userName && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">por {e.userName}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </ScrollArea>
          )}
        </div>
      )}
    </div>
  );
}
