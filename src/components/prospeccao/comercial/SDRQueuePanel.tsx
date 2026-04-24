import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Phone, MessageCircle, Instagram, SkipForward, Check, X, Loader2, Inbox, Plus } from "lucide-react";
import {
  useProspectingQueues,
  useQueueStats,
  useClaimNextLead,
  useUpdateQueueLead,
  useRedistributeQueue,
  type QueueLead,
} from "@/hooks/useProspectingQueue";
import { usePlayerProfile } from "@/hooks/usePlayerProfile";
import { CreateQueueDialog } from "./CreateQueueDialog";

export function SDRQueuePanel() {
  const { userId, companyId } = usePlayerProfile();
  const { data: queues, isLoading: loadingQueues } = useProspectingQueues(companyId);
  const [selectedQueueId, setSelectedQueueId] = useState<string>("");
  const [currentLead, setCurrentLead] = useState<QueueLead | null>(null);
  const [notes, setNotes] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const { data: stats } = useQueueStats(selectedQueueId || null, userId);
  const claimMutation = useClaimNextLead();
  const updateMutation = useUpdateQueueLead();
  const redistribute = useRedistributeQueue();

  useEffect(() => {
    if (!selectedQueueId && queues && queues.length > 0) {
      setSelectedQueueId(queues[0].id);
    }
  }, [queues, selectedQueueId]);

  const selectedQueue = useMemo(
    () => queues?.find((q) => q.id === selectedQueueId),
    [queues, selectedQueueId]
  );

  const handleNext = async () => {
    if (!selectedQueueId || !userId) return;
    setNotes("");
    const lead = await claimMutation.mutateAsync({ queueId: selectedQueueId, userId });
    setCurrentLead(lead);
  };

  const handleOutcome = async (outcome: "contacted" | "qualified" | "no_answer" | "skip") => {
    if (!currentLead) return;
    const status =
      outcome === "skip" ? "pending" : outcome === "qualified" ? "qualified" : "contacted";
    await updateMutation.mutateAsync({
      queueLeadId: currentLead.queue_lead_id,
      status,
      outcome,
      notes: notes || undefined,
    });
    setCurrentLead(null);
    setNotes("");
    // auto-advance
    handleNext();
  };

  const ChannelIcon =
    selectedQueue?.channel === "instagram" ? Instagram :
    selectedQueue?.channel === "whatsapp" ? MessageCircle :
    Phone;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={selectedQueueId} onValueChange={setSelectedQueueId}>
          <SelectTrigger className="w-[280px]">
            <SelectValue placeholder={loadingQueues ? "Carregando..." : "Selecione uma fila"} />
          </SelectTrigger>
          <SelectContent>
            {queues?.map((q) => (
              <SelectItem key={q.id} value={q.id}>
                {q.name} · {q.channel}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nova Fila
        </Button>
        {selectedQueueId && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => redistribute.mutate(selectedQueueId)}
            disabled={redistribute.isPending}
          >
            Redistribuir
          </Button>
        )}
      </div>

      {selectedQueue && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-3">
            <div className="text-xs text-muted-foreground">Minha fila</div>
            <div className="text-2xl font-bold">{stats?.pendingMine ?? 0}</div>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-muted-foreground">Total pendente</div>
            <div className="text-2xl font-bold">{stats?.pendingAll ?? 0}</div>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-muted-foreground">Em atendimento</div>
            <div className="text-2xl font-bold">{stats?.inProgress ?? 0}</div>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-muted-foreground">Concluídos</div>
            <div className="text-2xl font-bold">{stats?.done ?? 0}</div>
          </Card>
        </div>
      )}

      <Card className="p-6">
        {!currentLead ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
            <Inbox className="h-12 w-12 text-muted-foreground" />
            <div>
              <h3 className="text-lg font-semibold">Pronto para prospectar?</h3>
              <p className="text-sm text-muted-foreground">
                Clique em "Próximo lead" para receber um contato da fila automaticamente.
              </p>
            </div>
            <Button
              size="lg"
              onClick={handleNext}
              disabled={!selectedQueueId || claimMutation.isPending}
            >
              {claimMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ChannelIcon className="h-4 w-4 mr-2" />
              )}
              Próximo lead
            </Button>
            {claimMutation.isSuccess && claimMutation.data === null && (
              <p className="text-sm text-amber-600">Sem leads pendentes nesta fila.</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <ChannelIcon className="h-5 w-5 text-primary" />
                  <h3 className="text-xl font-bold">{currentLead.lead_name || "Sem nome"}</h3>
                  <Badge variant="outline">Tentativa #{currentLead.attempts}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {currentLead.lead_phone || "Sem telefone"}
                  {currentLead.lead_email ? ` · ${currentLead.lead_email}` : ""}
                </p>
                {currentLead.lead_tags && currentLead.lead_tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {currentLead.lead_tags.map((t) => (
                      <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                    ))}
                  </div>
                )}
              </div>
              {currentLead.lead_value ? (
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Valor</div>
                  <div className="text-lg font-bold">
                    {Number(currentLead.lead_value).toLocaleString("pt-BR", {
                      style: "currency", currency: "BRL",
                    })}
                  </div>
                </div>
              ) : null}
            </div>

            <Textarea
              placeholder="Anotações desta tentativa..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => handleOutcome("qualified")} className="bg-green-600 hover:bg-green-700">
                <Check className="h-4 w-4 mr-1" /> Qualificado
              </Button>
              <Button variant="secondary" onClick={() => handleOutcome("contacted")}>
                <MessageCircle className="h-4 w-4 mr-1" /> Contatado
              </Button>
              <Button variant="outline" onClick={() => handleOutcome("no_answer")}>
                <X className="h-4 w-4 mr-1" /> Sem resposta
              </Button>
              <Button variant="ghost" onClick={() => handleOutcome("skip")}>
                <SkipForward className="h-4 w-4 mr-1" /> Pular
              </Button>
            </div>
          </div>
        )}
      </Card>

      <CreateQueueDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        companyId={companyId || ""}
        userId={userId || ""}
      />
    </div>
  );
}
