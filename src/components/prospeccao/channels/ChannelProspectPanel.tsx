import { useEffect, useMemo, useState } from "react";
import { Phone, MessageSquare, Instagram, Send, Search, Star, StarOff, ExternalLink, Loader2, PhoneCall, Tag as TagIcon, ArrowRightLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useProspectingContacts, markLeadAsProspect, touchLastProspected, type ProspectChannel } from "@/hooks/useProspectingContacts";
import { useCallCenter } from "@/hooks/useCallCenter";
import { CallModal } from "@/components/discador/CallModal";
import { PostCallNotesDialog } from "@/components/discador/PostCallNotesDialog";
import { useTagsManager } from "@/hooks/useTagsManager";
import { ConversaPopup } from "@/components/leads/ConversaPopup";
import { HandoffDialog } from "@/components/prospeccao/comercial/HandoffDialog";
import { ColdCallActions } from "./ColdCallActions";

interface Props {
  channel: ProspectChannel;
}

const CHANNEL_META: Record<ProspectChannel, { label: string; icon: any; color: string; cta: string }> = {
  coldcall: { label: "Cold Call", icon: Phone, color: "text-cyan-400", cta: "Ligar" },
  instagram: { label: "Instagram", icon: Instagram, color: "text-pink-400", cta: "Conversar" },
  whatsapp: { label: "WhatsApp", icon: MessageSquare, color: "text-green-400", cta: "Conversar" },
};

export function ChannelProspectPanel({ channel }: Props) {
  const meta = CHANNEL_META[channel];
  const Icon = meta.icon;
  const navigate = useNavigate();
  const [filter, setFilter] = useState<"all" | "marked">("marked");
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [outcomeFilter, setOutcomeFilter] = useState<string>("all");
  const [showNotes, setShowNotes] = useState(false);

  // Popup de conversa inline (Instagram/WhatsApp)
  const [conversaOpen, setConversaOpen] = useState(false);
  const [activeLead, setActiveLead] = useState<{ id: string; name: string; phone?: string } | null>(null);
  const [handoffLead, setHandoffLead] = useState<{ id: string; name: string } | null>(null);

  const { allTags } = useTagsManager();

  const { data, isLoading, refetch } = useProspectingContacts({
    channel,
    onlyMarked: filter === "marked",
    search,
    limit: 200,
  });

  // Cold call only
  const callCenter = useCallCenter();
  const callOpen = channel === "coldcall" && callCenter.callState.isActive && callCenter.callState.status !== "finalizado";

  // Estado por lead (apenas Cold Call) — sincronizado em tempo real (fonte da verdade global)
  type LeadCallState = {
    outcome: string;
    attempts: number;
    last_attempt_at: string | null;
    attemptsList: any[];
  };
  const [leadStates, setLeadStates] = useState<Record<string, LeadCallState>>({});
  const [companyIdGlobal, setCompanyIdGlobal] = useState<string | null>(null);
  const [currentUserGlobal, setCurrentUserGlobal] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (channel !== "coldcall") return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: prof } = await supabase
        .from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      setCurrentUserGlobal({
        id: user.id,
        name: (prof as any)?.full_name || user.email?.split("@")[0] || "Usuário",
      });
    })();
  }, [channel]);

  useEffect(() => {
    if (channel !== "coldcall") return;
    let cancelled = false;
    let companyIdLocal: string | null = null;
    (async () => {
      const { data: cid } = await supabase.rpc("get_my_company_id");
      if (!cid || cancelled) return;
      companyIdLocal = cid as string;
      setCompanyIdGlobal(companyIdLocal);
      const map: Record<string, LeadCallState> = {};
      const PAGE = 1000;
      let from = 0;
      while (!cancelled) {
        const { data: rows, error } = await supabase
          .from("pre_sdr_analyses" as any)
          .select("row_key,outcome,lead_id,attempts,attempts_count,last_attempt_at")
          .eq("company_id", companyIdLocal)
          .not("lead_id", "is", null)
          .range(from, from + PAGE - 1);
        if (error) {
          console.error("[ChannelProspectPanel] erro carregando estados:", error);
          break;
        }
        if (!rows || rows.length === 0) break;
        rows.forEach((r: any) => {
          const id = r.lead_id || (typeof r.row_key === "string" && r.row_key.startsWith("lead:") ? r.row_key.slice(5) : null);
          if (!id) return;
          map[id] = {
            outcome: r.outcome || "pendente",
            attempts: r.attempts_count || 0,
            last_attempt_at: r.last_attempt_at || null,
            attemptsList: Array.isArray(r.attempts) ? r.attempts : [],
          };
        });
        if (rows.length < PAGE) break;
        from += PAGE;
      }
      if (!cancelled) setLeadStates(map);
    })();
    const ch = supabase
      .channel(`coldcall_states_${channel}_${Date.now()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "pre_sdr_analyses" }, (payload) => {
        const n: any = payload.new || payload.old;
        if (!n) return;
        const id = n.lead_id || (typeof n.row_key === "string" && n.row_key.startsWith("lead:") ? n.row_key.slice(5) : null);
        if (!id) return;
        const nn: any = payload.new || {};
        setLeadStates((prev) => {
          const old = prev[id] || { outcome: "pendente", attempts: 0, last_attempt_at: null, attemptsList: [] };
          return {
            ...prev,
            [id]: {
              outcome: nn.outcome ?? old.outcome,
              attempts: nn.attempts_count ?? old.attempts,
              last_attempt_at: nn.last_attempt_at ?? old.last_attempt_at,
              attemptsList: Array.isArray(nn.attempts) ? nn.attempts : old.attemptsList,
            },
          };
        });
      })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [channel]);


  const isToday = (iso: string | null) =>
    !!iso && new Date(iso).toDateString() === new Date().toDateString();

  // Aplicar filtros de tag + (cold call) outcome
  const tagFiltered = useMemo(() => {
    if (!data) return [];
    if (tagFilter === "all") return data;
    return data.filter((l: any) => Array.isArray(l.tags) && l.tags.includes(tagFilter));
  }, [data, tagFilter]);

  const filteredData = useMemo(() => {
    if (channel !== "coldcall" || outcomeFilter === "all") return tagFiltered;
    return tagFiltered.filter((l: any) => {
      const s = leadStates[l.id];
      if (outcomeFilter === "contactados_hoje") return !!s && isToday(s.last_attempt_at);
      if (outcomeFilter === "abordados") return !!s && s.attempts > 0;
      const o = s?.outcome || "pendente";
      return o === outcomeFilter;
    });
  }, [tagFiltered, outcomeFilter, leadStates, channel]);

  // Contagens por outcome (sobre tagFiltered)
  const outcomeCounts = useMemo(() => {
    const c: Record<string, number> = {
      all: tagFiltered.length,
      contactados_hoje: 0, abordados: 0,
      pendente: 0, prospectado: 0, sem_resposta: 0, oportunidade: 0,
      agendamento: 0, follow_up: 0, ganho: 0, descartado: 0,
    };
    tagFiltered.forEach((l: any) => {
      const s = leadStates[l.id];
      const o = s?.outcome || "pendente";
      c[o] = (c[o] || 0) + 1;
      if (s && s.attempts > 0) c.abordados++;
      if (s && isToday(s.last_attempt_at)) c.contactados_hoje++;
    });
    return c;
  }, [tagFiltered, leadStates]);



  const handleAction = async (lead: any) => {
    const phone = lead.phone || lead.telefone;
    try {
      await touchLastProspected(lead.id);
    } catch {}

    if (channel === "coldcall") {
      if (!phone) return toast.error("Lead sem telefone.");
      const ok = await callCenter.startCall(lead.id, lead.name, phone);
      if (!ok) toast.error("Não foi possível iniciar a chamada.");
    } else {
      // Instagram & WhatsApp → abrir popup inline
      setActiveLead({ id: lead.id, name: lead.name || "Sem nome", phone: phone || undefined });
      setConversaOpen(true);
    }
    refetch();
  };

  const toggleMark = async (lead: any) => {
    try {
      await markLeadAsProspect(lead.id, !lead.to_prospect, 1);
      toast.success(lead.to_prospect ? "Removido da fila" : "Adicionado à fila de prospecção");
      refetch();
    } catch (e: any) {
      toast.error(e.message || "Erro");
    }
  };

  const stats = useMemo(() => {
    const total = filteredData.length;
    const marked = filteredData.filter((l: any) => l.to_prospect).length;
    const contactedToday = channel === "coldcall"
      ? filteredData.filter((l: any) => isToday(leadStates[l.id]?.last_attempt_at || null)).length
      : filteredData.filter((l: any) => l.last_prospected_at && new Date(l.last_prospected_at).toDateString() === new Date().toDateString()).length;
    return { total, marked, contactedToday };
  }, [filteredData, channel, leadStates]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="p-4 bg-gradient-to-r from-background to-muted/40 border-border">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-muted ${meta.color}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold">{meta.label}</h3>
              <p className="text-xs text-muted-foreground">
                {stats.total} contatos · {stats.contactedToday} prospectados hoje
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
              <TabsList className="h-8">
                <TabsTrigger value="marked" className="text-xs h-7">Para prospectar</TabsTrigger>
                <TabsTrigger value="all" className="text-xs h-7">Todos</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Filtro por TAG (segmentação) */}
            <Select value={tagFilter} onValueChange={setTagFilter}>
              <SelectTrigger className="h-8 w-44 text-xs">
                <TagIcon className="h-3 w-3 mr-1 text-muted-foreground" />
                <SelectValue placeholder="Todas as tags" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="all">Todas as tags</SelectItem>
                {allTags.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative">
              <Search className="h-3 w-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-7 w-48 text-xs"
              />
            </div>
          </div>
        </div>

        {channel === "coldcall" && (
          <div className="flex items-center gap-1.5 flex-wrap mt-3 pt-3 border-t border-border">
            <span className="text-[11px] text-muted-foreground mr-1">Filtrar:</span>
            {([
              { v: "all", label: "Todos", cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" },
              { v: "contactados_hoje", label: "Contactados hoje", cls: "bg-cyan-500/15 text-cyan-600 border-cyan-500/40" },
              { v: "abordados", label: "Já abordados", cls: "bg-indigo-500/10 text-indigo-600 border-indigo-500/30" },
              { v: "pendente", label: "Pendente (sem tentativa)", cls: "bg-muted text-muted-foreground border-border" },
              { v: "prospectado", label: "Prospectado (OK)", cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
              { v: "sem_resposta", label: "Sem resposta", cls: "bg-slate-500/10 text-slate-500 border-slate-500/30" },
              { v: "oportunidade", label: "Oportunidade", cls: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
              { v: "agendamento", label: "Agendamento", cls: "bg-purple-500/10 text-purple-600 border-purple-500/30" },
              { v: "follow_up", label: "Follow-up", cls: "bg-cyan-500/10 text-cyan-600 border-cyan-500/30" },
              { v: "ganho", label: "Ganho", cls: "bg-emerald-600/10 text-emerald-700 border-emerald-600/30" },
              { v: "descartado", label: "Descartado", cls: "bg-rose-500/10 text-rose-600 border-rose-500/30" },
            ] as const).map((o) => {
              const active = outcomeFilter === o.v;
              const count = outcomeCounts[o.v] ?? 0;
              return (
                <button
                  key={o.v}
                  onClick={() => setOutcomeFilter(o.v)}
                  className={`text-[11px] px-2 py-0.5 rounded-full border transition-all ${o.cls} ${active ? "ring-2 ring-offset-1 ring-offset-background ring-current font-semibold" : "opacity-80 hover:opacity-100"}`}
                >
                  {o.label} ({count})
                </button>
              );
            })}
          </div>
        )}
      </Card>

      {/* List */}
      <Card className="border-border">
        <ScrollArea className="h-[480px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando…
            </div>
          ) : !filteredData || filteredData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <Icon className="h-10 w-10 opacity-30" />
              <p className="text-sm">
                {filter === "marked"
                  ? "Nenhum contato marcado para prospectar neste canal."
                  : "Nenhum contato encontrado."}
              </p>
              {filter === "marked" && (
                <Button variant="outline" size="sm" onClick={() => setFilter("all")}>
                  Ver todos os contatos
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredData.map((lead: any) => {
                const phone = lead.phone || lead.telefone;
                const lastTs = lead.last_prospected_at ? new Date(lead.last_prospected_at) : null;
                return (
                  <div key={lead.id} className="flex items-center gap-3 p-3 hover:bg-muted/40 transition-colors">
                    <button
                      onClick={() => toggleMark(lead)}
                      className="shrink-0"
                      title={lead.to_prospect ? "Remover da fila" : "Marcar para prospectar"}
                    >
                      {lead.to_prospect ? (
                        <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                      ) : (
                        <StarOff className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm truncate">{lead.name || "Sem nome"}</p>
                        {lastTs && (
                          <Badge variant="outline" className="text-[10px] h-4">
                            Último: {lastTs.toLocaleDateString("pt-BR")}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                        {phone && <span>📞 {phone}</span>}
                        {lead.email && <span className="truncate">✉️ {lead.email}</span>}
                        {Array.isArray(lead.tags) && lead.tags.slice(0, 3).map((t: string) => (
                          <Badge key={t} variant="secondary" className="text-[10px] h-4">{t}</Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                      <Button
                        size="sm"
                        variant={channel === "coldcall" ? "default" : "outline"}
                        onClick={() => handleAction(lead)}
                      >
                        {channel === "coldcall" ? <PhoneCall className="h-3.5 w-3.5 mr-1" /> :
                         channel === "instagram" ? <Instagram className="h-3.5 w-3.5 mr-1" /> :
                         <Send className="h-3.5 w-3.5 mr-1" />}
                        {meta.cta}
                      </Button>
                      {channel === "coldcall" && (
                        <ColdCallActions
                          lead={lead}
                          externalCompanyId={companyIdGlobal}
                          externalUser={currentUserGlobal}
                          externalState={{
                            outcome: leadStates[lead.id]?.outcome,
                            attempts: leadStates[lead.id]?.attemptsList || [],
                          }}
                        />
                      )}
                      <Button size="icon" variant="ghost" onClick={() => setHandoffLead({ id: lead.id, name: lead.name || "Lead" })} title="Passar para Closer">
                        <ArrowRightLeft className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => navigate(`/leads?id=${lead.id}`)} title="Abrir lead">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </Card>

      {/* Popup de Conversa Inline (Instagram & WhatsApp) */}
      {activeLead && (channel === "instagram" || channel === "whatsapp") && (
        <ConversaPopup
          open={conversaOpen}
          onOpenChange={(open) => {
            setConversaOpen(open);
            if (!open) {
              setActiveLead(null);
              refetch();
            }
          }}
          leadId={activeLead.id}
          leadName={activeLead.name}
          leadPhone={activeLead.phone}
        />
      )}

      {/* Cold Call Modal */}
      {channel === "coldcall" && (
        <>
          {callOpen && (
            <CallModal
              open
              onClose={() => {}}
              leadName={callCenter.callState.leadName}
              phoneNumber={callCenter.callState.phoneNumber}
              status={callCenter.callState.status}
              duration={callCenter.callState.duration}
              isMuted={callCenter.callState.isMuted}
              onEndCall={async () => {
                await callCenter.endCall();
                setShowNotes(true);
              }}
              onToggleMute={callCenter.toggleMute}
            />
          )}
          <PostCallNotesDialog
            open={showNotes}
            leadName={callCenter.callState.leadName}
            phoneNumber={callCenter.callState.phoneNumber}
            duration={callCenter.callState.duration}
            onSave={async (notes: string) => {
              await callCenter.saveCallNotes(notes);
              setShowNotes(false);
              refetch();
            }}
          />
        </>
      )}

      {handoffLead && (
        <HandoffDialog
          open={!!handoffLead}
          onOpenChange={(o) => !o && setHandoffLead(null)}
          leadId={handoffLead.id}
          leadName={handoffLead.name}
        />
      )}
    </div>
  );
}
