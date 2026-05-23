import { useMemo, useState } from "react";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  closestCenter, DragStartEvent, DragEndEvent,
} from "@dnd-kit/core";
import { useDroppable, useDraggable } from "@dnd-kit/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Plus, Phone, AlertTriangle, Target, Users, TrendingUp, Activity,
  MoreVertical, ChevronDown, DollarSign, MessageCircle, MoveHorizontal,
  Calendar, CheckSquare, Trash2, PhoneCall,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useHunterPipeline, type HunterLead, type HunterStage } from "@/hooks/useHunterPipeline";
import { HunterStageForm } from "./HunterStageForm";
import { HunterLeadDrawer, QUICK_REGISTRY, RESULT_OPTIONS } from "./HunterLeadDrawer";

const COLUMNS: { id: HunterStage; label: string; color: string }[] = [
  { id: "novo", label: "Leads Novos", color: "hsl(200, 50%, 60%)" },
  { id: "tentativa_contato", label: "Tentativa de Contato", color: "hsl(40, 90%, 55%)" },
  { id: "follow_up", label: "Follow-up", color: "hsl(190, 70%, 50%)" },
  { id: "contato_realizado", label: "Contato Realizado", color: "hsl(210, 80%, 55%)" },
  { id: "buscando_decisor", label: "Buscando Decisor", color: "hsl(270, 60%, 55%)" },
  { id: "conversa_decisor", label: "Conversa Decisor", color: "hsl(290, 60%, 55%)" },
  { id: "oportunidade", label: "Oportunidade", color: "hsl(142, 70%, 45%)" },
  { id: "descartado", label: "Descartado", color: "hsl(0, 70%, 50%)" },
];

function isStale(iso: string | null): boolean {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() > 24 * 60 * 60 * 1000;
}

function HunterCard({ lead, isDragging, onClick, onLogAttempt }: { lead: HunterLead; isDragging?: boolean; onClick: () => void; onLogAttempt: (substatus: string) => void }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: lead.id, data: { lead } });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 50 } : undefined;
  const stale = isStale(lead.last_action_at);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border bg-card p-2.5 text-xs space-y-1.5 shadow-sm hover:border-primary/40 transition ${isDragging ? "opacity-50" : ""}`}
    >
      <div className="flex items-center justify-between gap-1">
        <button {...listeners} {...attributes} className="flex items-center gap-1 min-w-0 cursor-grab active:cursor-grabbing">
          <GripVertical className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          <span className="font-medium truncate">{lead.lead_company || lead.lead_name || "Lead"}</span>
        </button>
        <div className="flex items-center gap-1">
          {lead.decisor_classificacao && (
            <Badge variant="outline" className="text-[9px] px-1.5 h-4">{lead.decisor_classificacao}</Badge>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                aria-label="Registrar ação"
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 z-[60]">
              <DropdownMenuLabel className="text-[10px]">Registrar ação</DropdownMenuLabel>
              {QUICK_REGISTRY.map(({ key, label, icon: Icon, color }) => (
                <DropdownMenuItem key={key} onClick={() => onLogAttempt(key)} className="text-xs">
                  <Icon className={`h-3.5 w-3.5 mr-2 ${color}`} /> {label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[10px]">Resultado</DropdownMenuLabel>
              {RESULT_OPTIONS.map((r) => (
                <DropdownMenuItem key={r.key} onClick={() => onLogAttempt(r.key)} className="text-xs">
                  {r.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <button onClick={onClick} className="block text-left w-full space-y-1">
        {lead.lead_name && lead.lead_company && (
          <p className="text-muted-foreground truncate">{lead.lead_name}</p>
        )}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><Phone className="h-2.5 w-2.5" />{lead.attempts}</span>
          {lead.last_action_at && (
            <span>{formatDistanceToNow(new Date(lead.last_action_at), { locale: ptBR, addSuffix: true })}</span>
          )}
        </div>
        {lead.substatus && <Badge variant="secondary" className="text-[9px] h-4">{lead.substatus}</Badge>}
        {stale && (
          <div className="flex items-center gap-1 text-[10px] text-amber-600">
            <AlertTriangle className="h-2.5 w-2.5" /> Parado &gt;24h
          </div>
        )}
      </button>
    </div>
  );
}

function HunterColumn({ col, leads, children }: { col: typeof COLUMNS[0]; leads: HunterLead[]; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });
  return (
    <div ref={setNodeRef} className={`flex-shrink-0 w-[270px] rounded-xl border bg-muted/30 transition-all ${isOver ? "ring-2 ring-primary/50 bg-primary/5" : ""}`}>
      <div className="p-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: col.color }} />
          <span className="text-sm font-semibold">{col.label}</span>
        </div>
        <Badge variant="secondary" className="text-xs">{leads.length}</Badge>
      </div>
      <ScrollArea className="h-[560px]">
        <div className="p-2 space-y-2 min-h-[80px]">
          {children}
          {leads.length === 0 && <p className="text-[11px] text-muted-foreground text-center py-6">Vazio</p>}
        </div>
      </ScrollArea>
    </div>
  );
}

export function HunterPipelineBoard() {
  const { leads, loading, companyId, moveStage, logCallAttempt, fetchEvents, load } = useHunterPipeline();
  const [active, setActive] = useState<HunterLead | null>(null);
  const [pendingMove, setPendingMove] = useState<{ lead: HunterLead; to: HunterStage } | null>(null);
  const [drawer, setDrawer] = useState<HunterLead | null>(null);
  const [importing, setImporting] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const kpis = useMemo(() => {
    const total = leads.length;
    const contacted = leads.filter(l => ["contato_realizado", "buscando_decisor", "conversa_decisor", "oportunidade"].includes(l.stage)).length;
    const decisor = leads.filter(l => ["conversa_decisor", "oportunidade"].includes(l.stage)).length;
    const opps = leads.filter(l => l.stage === "oportunidade").length;
    const totalCalls = leads.reduce((a, l) => a + l.attempts, 0);
    return {
      total,
      conexaoRate: totalCalls ? Math.round((contacted / totalCalls) * 100) : 0,
      decisorRate: contacted ? Math.round((decisor / contacted) * 100) : 0,
      oppRate: decisor ? Math.round((opps / decisor) * 100) : 0,
    };
  }, [leads]);

  const handleDragStart = (e: DragStartEvent) => {
    const l = leads.find(x => x.id === e.active.id);
    setActive(l || null);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActive(null);
    const { active: a, over } = e;
    if (!over) return;
    const lead = leads.find(l => l.id === a.id);
    const toStage = over.id as HunterStage;
    if (!lead || lead.stage === toStage) return;

    // Stages que exigem formulário
    if (["tentativa_contato", "follow_up", "contato_realizado", "buscando_decisor", "conversa_decisor", "oportunidade", "descartado"].includes(toStage)) {
      setPendingMove({ lead, to: toStage });
    } else {
      moveStage(lead.id, toStage);
    }
  };

  const importNewLeads = async () => {
    if (!companyId || importing) return;
    setImporting(true);
    try {
      // Importa leads cold call (sem registro no pipeline) com phone
      const existingIds = new Set(leads.map(l => l.lead_id).filter(Boolean));
      const { data: candidates } = await supabase
        .from("leads")
        .select("id,name,phone")
        .eq("company_id", companyId)
        .not("phone", "is", null)
        .limit(200);
      const toImport = (candidates || []).filter((l: any) => !existingIds.has(l.id));
      if (toImport.length === 0) {
        toast.info("Nenhum lead novo para importar");
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      const rows = toImport.map((l: any) => ({
        company_id: companyId,
        lead_id: l.id,
        assigned_to: user?.id ?? null,
        stage: "novo" as HunterStage,
      }));
      const { error } = await supabase
        .from("hunter_pipeline_leads" as any)
        .upsert(rows, { onConflict: "company_id,lead_id", ignoreDuplicates: true });
      if (error) throw error;
      toast.success(`${rows.length} lead(s) processado(s)`);
      load();
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao importar leads");
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">Carregando pipeline...</div>;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Target className="h-4 w-4" /> Pipeline Hunter
          </CardTitle>
          <Button size="sm" variant="outline" onClick={importNewLeads} disabled={importing}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            {importing ? "Importando..." : "Importar leads"}
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
          <div className="rounded-lg border p-2.5">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground"><Users className="h-3 w-3" /> No pipeline</div>
            <p className="text-lg font-bold">{kpis.total}</p>
          </div>
          <div className="rounded-lg border p-2.5">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground"><Activity className="h-3 w-3" /> Taxa de Conexão</div>
            <p className="text-lg font-bold">{kpis.conexaoRate}%</p>
          </div>
          <div className="rounded-lg border p-2.5">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground"><Target className="h-3 w-3" /> Taxa de Decisor</div>
            <p className="text-lg font-bold">{kpis.decisorRate}%</p>
          </div>
          <div className="rounded-lg border p-2.5">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground"><TrendingUp className="h-3 w-3" /> Taxa de Oportunidade</div>
            <p className="text-lg font-bold">{kpis.oppRate}%</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 pb-4">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <ScrollArea className="w-full">
            <div className="flex gap-3 px-4 pb-2 min-w-max">
              {COLUMNS.map(col => {
                const colLeads = leads.filter(l => l.stage === col.id);
                return (
                  <HunterColumn key={col.id} col={col} leads={colLeads}>
                    {colLeads.map(l => (
                      <HunterCard
                        key={l.id}
                        lead={l}
                        isDragging={active?.id === l.id}
                        onClick={() => setDrawer(l)}
                        onLogAttempt={(s) => logCallAttempt(l.id, s)}
                      />
                    ))}
                  </HunterColumn>
                );
              })}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          <DragOverlay>
            {active && (
              <div className="rounded-lg border bg-card p-2.5 text-xs shadow-lg w-[250px] rotate-2">
                <div className="flex items-center gap-1.5">
                  <GripVertical className="h-3 w-3 text-muted-foreground" />
                  <span className="font-medium truncate">{active.lead_company || active.lead_name || "Lead"}</span>
                </div>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </CardContent>

      {pendingMove && (
        <HunterStageForm
          open
          lead={pendingMove.lead}
          toStage={pendingMove.to}
          onCancel={() => setPendingMove(null)}
          onConfirm={(patch) => {
            moveStage(pendingMove.lead.id, pendingMove.to, patch);
            setPendingMove(null);
          }}
        />
      )}

      <HunterLeadDrawer
        open={!!drawer}
        onClose={() => setDrawer(null)}
        lead={drawer}
        fetchEvents={fetchEvents}
        onLogAttempt={(s) => drawer && logCallAttempt(drawer.id, s)}
      />
    </Card>
  );
}
