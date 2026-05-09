import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Tag, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAddLeadsToQueue } from "@/hooks/useProspectingQueue";
import { toast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companyId: string;
  queueId: string;
  queueName?: string;
}

interface LeadRow {
  id: string;
  name: string | null;
  telefone: string | null;
  tags: string[] | null;
}

export function AddLeadsByTagsDialog({ open, onOpenChange, companyId, queueId, queueName }: Props) {
  const [allTags, setAllTags] = useState<{ tag: string; count: number }[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [matchMode, setMatchMode] = useState<"any" | "all">("any");
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [loadingTags, setLoadingTags] = useState(false);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [existingInQueue, setExistingInQueue] = useState<Set<string>>(new Set());
  const addLeads = useAddLeadsToQueue();

  // Carregar todas as tags da empresa
  useEffect(() => {
    if (!open || !companyId) return;
    setLoadingTags(true);
    (async () => {
      const PAGE = 1000;
      let from = 0;
      const counts = new Map<string, number>();
      while (true) {
        const { data, error } = await supabase
          .from("leads")
          .select("tags")
          .eq("company_id", companyId)
          .not("tags", "is", null)
          .range(from, from + PAGE - 1);
        if (error) break;
        const rows = (data || []) as { tags: string[] | null }[];
        rows.forEach((r) => {
          (r.tags || []).forEach((t) => {
            if (!t) return;
            counts.set(t, (counts.get(t) || 0) + 1);
          });
        });
        if (rows.length < PAGE) break;
        from += PAGE;
      }
      const arr = Array.from(counts.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count);
      setAllTags(arr);
      setLoadingTags(false);
    })();

    // Carregar leads já na fila para filtrar
    (async () => {
      const { data } = await supabase
        .from("prospecting_queue_leads")
        .select("lead_id")
        .eq("queue_id", queueId);
      setExistingInQueue(new Set(((data || []) as any[]).map((r) => r.lead_id)));
    })();
  }, [open, companyId, queueId]);

  // Buscar leads conforme tags selecionadas
  useEffect(() => {
    if (!open || !companyId) return;
    if (selectedTags.length === 0) {
      setLeads([]);
      setSelectedLeads(new Set());
      return;
    }
    setLoadingLeads(true);
    (async () => {
      const PAGE = 1000;
      let from = 0;
      const all: LeadRow[] = [];
      while (true) {
        let q = supabase
          .from("leads")
          .select("id, name, telefone, tags")
          .eq("company_id", companyId)
          .range(from, from + PAGE - 1);
        if (matchMode === "any") {
          q = q.overlaps("tags", selectedTags);
        } else {
          q = q.contains("tags", selectedTags);
        }
        const { data, error } = await q;
        if (error) break;
        const rows = (data || []) as LeadRow[];
        all.push(...rows);
        if (rows.length < PAGE) break;
        from += PAGE;
      }
      setLeads(all);
      // pré-selecionar todos exceto os que já estão na fila
      const pre = new Set<string>();
      all.forEach((l) => { if (!existingInQueue.has(l.id)) pre.add(l.id); });
      setSelectedLeads(pre);
      setLoadingLeads(false);
    })();
  }, [open, companyId, selectedTags, matchMode, existingInQueue]);

  const filteredLeads = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return leads;
    return leads.filter(
      (l) =>
        (l.name || "").toLowerCase().includes(s) ||
        (l.telefone || "").toLowerCase().includes(s)
    );
  }, [leads, search]);

  const toggleTag = (tag: string) => {
    setSelectedTags((cur) => (cur.includes(tag) ? cur.filter((t) => t !== tag) : [...cur, tag]));
  };

  const toggleLead = (id: string) => {
    setSelectedLeads((cur) => {
      const n = new Set(cur);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const toggleAll = () => {
    if (selectedLeads.size === filteredLeads.filter((l) => !existingInQueue.has(l.id)).length) {
      setSelectedLeads(new Set());
    } else {
      const n = new Set<string>();
      filteredLeads.forEach((l) => { if (!existingInQueue.has(l.id)) n.add(l.id); });
      setSelectedLeads(n);
    }
  };

  const handleAdd = async () => {
    const ids = Array.from(selectedLeads).filter((id) => !existingInQueue.has(id));
    if (ids.length === 0) {
      toast({ title: "Nenhum lead selecionado", variant: "destructive" });
      return;
    }
    await addLeads.mutateAsync({ queueId, companyId, leadIds: ids });
    setSelectedTags([]);
    setLeads([]);
    setSelectedLeads(new Set());
    onOpenChange(false);
  };

  const eligibleCount = filteredLeads.filter((l) => !existingInQueue.has(l.id)).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-4 w-4" /> Adicionar leads por tags
            {queueName && <span className="text-sm text-muted-foreground font-normal">→ {queueName}</span>}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto pr-1">
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Tags disponíveis</Label>
              <div className="flex gap-1 text-xs">
                <button
                  type="button"
                  onClick={() => setMatchMode("any")}
                  className={`px-2 py-1 rounded border ${matchMode === "any" ? "bg-primary text-primary-foreground" : "bg-background"}`}
                >
                  Qualquer tag
                </button>
                <button
                  type="button"
                  onClick={() => setMatchMode("all")}
                  className={`px-2 py-1 rounded border ${matchMode === "all" ? "bg-primary text-primary-foreground" : "bg-background"}`}
                >
                  Todas as tags
                </button>
              </div>
            </div>
            {loadingTags ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Carregando tags...
              </div>
            ) : allTags.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma tag encontrada nos leads.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                {allTags.map((t) => {
                  const active = selectedTags.includes(t.tag);
                  return (
                    <button
                      key={t.tag}
                      type="button"
                      onClick={() => toggleTag(t.tag)}
                      className={`text-xs px-2 py-1 rounded-full border transition ${
                        active
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background hover:bg-muted"
                      }`}
                    >
                      {t.tag} <span className="opacity-60">· {t.count}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {selectedTags.length > 0 && (
            <>
              <div className="flex items-center justify-between gap-2">
                <div className="relative flex-1">
                  <Search className="h-3 w-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar por nome ou telefone..."
                    className="pl-7 h-8 text-sm"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={toggleAll} disabled={loadingLeads}>
                  {selectedLeads.size > 0 && selectedLeads.size === eligibleCount
                    ? "Limpar"
                    : "Selecionar todos"}
                </Button>
              </div>

              <div className="border rounded-md max-h-64 overflow-y-auto">
                {loadingLeads ? (
                  <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> Buscando leads...
                  </div>
                ) : filteredLeads.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground text-center">
                    Nenhum lead encontrado com as tags selecionadas.
                  </p>
                ) : (
                  filteredLeads.map((l) => {
                    const inQueue = existingInQueue.has(l.id);
                    const checked = selectedLeads.has(l.id);
                    return (
                      <label
                        key={l.id}
                        className={`flex items-center gap-2 p-2 border-b last:border-0 text-sm ${
                          inQueue ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-muted/50"
                        }`}
                      >
                        <Checkbox
                          checked={checked}
                          disabled={inQueue}
                          onCheckedChange={() => !inQueue && toggleLead(l.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{l.name || "Sem nome"}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {l.telefone || "Sem telefone"}
                            {l.tags && l.tags.length > 0 && (
                              <> · {l.tags.slice(0, 3).join(", ")}{l.tags.length > 3 ? "..." : ""}</>
                            )}
                          </p>
                        </div>
                        {inQueue && <Badge variant="secondary" className="text-[10px]">Já na fila</Badge>}
                      </label>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter className="border-t pt-3 mt-2">
          <div className="flex-1 text-xs text-muted-foreground self-center">
            {selectedLeads.size} de {eligibleCount} elegíveis selecionados
          </div>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={handleAdd}
            disabled={selectedLeads.size === 0 || addLeads.isPending}
          >
            {addLeads.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
            Adicionar {selectedLeads.size} {selectedLeads.size === 1 ? "lead" : "leads"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
