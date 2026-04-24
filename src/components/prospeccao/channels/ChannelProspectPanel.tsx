import { useMemo, useState } from "react";
import { Phone, MessageSquare, Instagram, Send, Search, Star, StarOff, ExternalLink, Loader2, PhoneCall, PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useProspectingContacts, markLeadAsProspect, touchLastProspected, type ProspectChannel } from "@/hooks/useProspectingContacts";
import { useCallCenter } from "@/hooks/useCallCenter";
import { CallModal } from "@/components/discador/CallModal";
import { PostCallNotesDialog } from "@/components/discador/PostCallNotesDialog";

interface Props {
  channel: ProspectChannel;
}

const CHANNEL_META: Record<ProspectChannel, { label: string; icon: any; color: string; cta: string }> = {
  coldcall: { label: "Cold Call", icon: Phone, color: "text-cyan-400", cta: "Ligar" },
  instagram: { label: "Instagram", icon: Instagram, color: "text-pink-400", cta: "Abrir DM" },
  whatsapp: { label: "WhatsApp", icon: MessageSquare, color: "text-green-400", cta: "Conversar" },
};

export function ChannelProspectPanel({ channel }: Props) {
  const meta = CHANNEL_META[channel];
  const Icon = meta.icon;
  const navigate = useNavigate();
  const [filter, setFilter] = useState<"all" | "marked">("marked");
  const [search, setSearch] = useState("");
  const [showNotes, setShowNotes] = useState(false);

  const { data, isLoading, refetch } = useProspectingContacts({
    channel,
    onlyMarked: filter === "marked",
    search,
    limit: 200,
  });

  // Cold call only
  const callCenter = useCallCenter();
  const callOpen = channel === "coldcall" && callCenter.callState.isActive && callCenter.callState.status !== "finalizado";

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
      // IG e WhatsApp → abrir conversa
      const target = phone || lead.id;
      navigate(`/conversas?phone=${encodeURIComponent(target)}&channel=${channel}&leadId=${lead.id}`);
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
    const total = data?.length || 0;
    const marked = data?.filter((l) => l.to_prospect).length || 0;
    const contactedToday = data?.filter((l) => l.last_prospected_at && new Date(l.last_prospected_at).toDateString() === new Date().toDateString()).length || 0;
    return { total, marked, contactedToday };
  }, [data]);

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
          <div className="flex items-center gap-2">
            <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
              <TabsList className="h-8">
                <TabsTrigger value="marked" className="text-xs h-7">Para prospectar</TabsTrigger>
                <TabsTrigger value="all" className="text-xs h-7">Todos</TabsTrigger>
              </TabsList>
            </Tabs>
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
      </Card>

      {/* List */}
      <Card className="border-border">
        <ScrollArea className="h-[480px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando…
            </div>
          ) : !data || data.length === 0 ? (
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
              {data.map((lead: any) => {
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
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{lead.name || "Sem nome"}</p>
                        {lastTs && (
                          <Badge variant="outline" className="text-[10px] h-4">
                            Último: {lastTs.toLocaleDateString("pt-BR")}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        {phone && <span>📞 {phone}</span>}
                        {lead.email && <span className="truncate">✉️ {lead.email}</span>}
                        {Array.isArray(lead.tags) && lead.tags.slice(0, 2).map((t: string) => (
                          <Badge key={t} variant="secondary" className="text-[10px] h-4">{t}</Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant={channel === "coldcall" ? "default" : "outline"}
                        onClick={() => handleAction(lead)}
                        className={channel === "coldcall" ? "bg-cyan-600 hover:bg-cyan-700" : ""}
                      >
                        {channel === "coldcall" ? <PhoneCall className="h-3.5 w-3.5 mr-1" /> :
                         channel === "instagram" ? <Instagram className="h-3.5 w-3.5 mr-1" /> :
                         <Send className="h-3.5 w-3.5 mr-1" />}
                        {meta.cta}
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
    </div>
  );
}
