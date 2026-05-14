import { useEffect, useMemo, useState } from "react";
import { Mail, Search, Star, StarOff, Loader2, Send, Megaphone, CheckCircle2, XCircle, Settings, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useTagsManager } from "@/hooks/useTagsManager";
import { EmailComposer } from "@/components/email/EmailComposer";

interface Lead {
  id: string;
  name: string | null;
  email: string | null;
  tags: string[] | null;
  to_prospect: boolean | null;
  last_prospected_at: string | null;
}

const isToday = (iso: string | null) =>
  !!iso && new Date(iso).toDateString() === new Date().toDateString();

export function EmailProspectPanel() {
  const { allTags } = useTagsManager();

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [gmailStatus, setGmailStatus] = useState<string>("disconnected");
  const [gmailEmail, setGmailEmail] = useState<string | null>(null);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const [filter, setFilter] = useState<"marked" | "all">("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Single send
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerLead, setComposerLead] = useState<Lead | null>(null);

  // Bulk send
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkSubject, setBulkSubject] = useState("");
  const [bulkBody, setBulkBody] = useState("");
  const [bulkHtml, setBulkHtml] = useState(false);
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ ok: 0, fail: 0, total: 0 });

  // Carregar company + status gmail
  useEffect(() => {
    (async () => {
      const { data: cid } = await supabase.rpc("get_my_company_id");
      if (!cid) return;
      setCompanyId(cid as string);
      const { data: integ } = await supabase
        .from("tenant_integrations")
        .select("gmail_email, gmail_status")
        .eq("company_id", cid as string)
        .maybeSingle();
      if (integ) {
        setGmailEmail((integ as any).gmail_email || null);
        setGmailStatus((integ as any).gmail_status || "disconnected");
      }
    })();
  }, []);

  // Carregar leads com email
  const loadLeads = async () => {
    if (!companyId) return;
    setLoading(true);
    let q = supabase
      .from("leads")
      .select("id, name, email, tags, to_prospect, last_prospected_at")
      .eq("company_id", companyId)
      .is("lead_origem_id", null)
      .not("email", "is", null)
      .neq("email", "")
      .order("last_prospected_at", { ascending: true, nullsFirst: true })
      .limit(500);
    if (filter === "marked") q = q.eq("to_prospect", true);
    if (search) q = q.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    const { data, error } = await q;
    setLoading(false);
    if (error) {
      toast.error("Erro ao carregar contatos: " + error.message);
      return;
    }
    setLeads((data || []) as Lead[]);
  };

  useEffect(() => { loadLeads(); /* eslint-disable-next-line */ }, [companyId, filter, search]);

  const filteredLeads = useMemo(() => {
    let rows = leads;
    if (tagFilter !== "all") {
      rows = rows.filter((l) => Array.isArray(l.tags) && l.tags.includes(tagFilter));
    }
    return rows;
  }, [leads, tagFilter]);

  const stats = useMemo(() => ({
    total: filteredLeads.length,
    marked: filteredLeads.filter((l) => l.to_prospect).length,
    sentToday: filteredLeads.filter((l) => isToday(l.last_prospected_at)).length,
  }), [filteredLeads]);

  const allSelected = filteredLeads.length > 0 && filteredLeads.every((l) => selected.has(l.id));
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(filteredLeads.map((l) => l.id)));
  };
  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const isConnected = gmailStatus === "connected" && !!gmailEmail;

  const toggleMark = async (lead: Lead) => {
    const { error } = await supabase
      .from("leads")
      .update({ to_prospect: !lead.to_prospect } as any)
      .eq("id", lead.id);
    if (error) return toast.error(error.message);
    toast.success(lead.to_prospect ? "Removido da fila" : "Marcado para prospectar");
    loadLeads();
  };

  const openComposer = (lead: Lead) => {
    if (!isConnected) {
      toast.error("Conecte o Gmail nas Configurações antes de enviar.");
      return;
    }
    setComposerLead(lead);
    setComposerOpen(true);
  };

  const renderTemplate = (tpl: string, lead: Lead) => {
    const first = (lead.name || "").split(" ")[0] || "";
    return tpl
      .replace(/\{\{\s*nome\s*\}\}/gi, lead.name || "")
      .replace(/\{\{\s*name\s*\}\}/gi, lead.name || "")
      .replace(/\{\{\s*primeiro_nome\s*\}\}/gi, first)
      .replace(/\{\{\s*first_name\s*\}\}/gi, first)
      .replace(/\{\{\s*email\s*\}\}/gi, lead.email || "");
  };

  const runBulk = async () => {
    if (!isConnected) return toast.error("Gmail não conectado.");
    if (!bulkSubject.trim() || !bulkBody.trim()) return toast.error("Preencha assunto e mensagem.");
    const recipients = filteredLeads.filter((l) => selected.has(l.id) && l.email);
    if (recipients.length === 0) return toast.error("Selecione ao menos um contato.");

    setBulkSending(true);
    setBulkProgress({ ok: 0, fail: 0, total: recipients.length });
    let ok = 0, fail = 0;
    for (const lead of recipients) {
      try {
        const { data, error } = await supabase.functions.invoke("enviar-email-gmail", {
          body: {
            company_id: companyId,
            to: lead.email,
            subject: renderTemplate(bulkSubject, lead),
            body: renderTemplate(bulkBody, lead),
            is_html: bulkHtml,
            lead_id: lead.id,
          },
        });
        if (error || (data as any)?.error) throw new Error(error?.message || (data as any)?.error);
        await supabase.from("leads").update({ last_prospected_at: new Date().toISOString() } as any).eq("id", lead.id);
        ok++;
      } catch (e: any) {
        console.error("[bulk-email] falha", lead.email, e);
        fail++;
      }
      setBulkProgress({ ok, fail, total: recipients.length });
      // pequena pausa para evitar throttle do Gmail
      await new Promise((r) => setTimeout(r, 250));
    }
    setBulkSending(false);
    toast.success(`Campanha concluída: ${ok} enviados, ${fail} falhas.`);
    if (ok > 0) {
      setBulkOpen(false);
      setSelected(new Set());
      loadLeads();
    }
  };

  return (
    <div className="space-y-4">
      {/* Status Gmail */}
      <Card className={`p-3 border ${isConnected ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/40 bg-amber-500/5"}`}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            {isConnected ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            )}
            <div>
              <p className="text-sm font-medium">
                {isConnected ? "Gmail conectado" : "Gmail não conectado"}
              </p>
              <p className="text-xs text-muted-foreground">
                {isConnected
                  ? `Enviando como ${gmailEmail}`
                  : "Conecte sua conta Gmail nas Configurações para enviar e-mails de prospecção."}
              </p>
            </div>
          </div>
          <Button size="sm" variant={isConnected ? "outline" : "default"} asChild>
            <Link to="/configuracoes">
              <Settings className="h-3.5 w-3.5 mr-1" />
              {isConnected ? "Gerenciar" : "Conectar Gmail"}
            </Link>
          </Button>
        </div>
      </Card>

      {/* Header */}
      <Card className="p-4 bg-gradient-to-r from-background to-muted/40 border-border">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted text-red-500">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold">E-mail</h3>
              <p className="text-xs text-muted-foreground">
                {stats.total} contatos com e-mail · {stats.sentToday} prospectados hoje · {selected.size} selecionados
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant="default"
              disabled={selected.size === 0 || !isConnected}
              onClick={() => setBulkOpen(true)}
            >
              <Megaphone className="h-3.5 w-3.5 mr-1" />
              Campanha em massa ({selected.size})
            </Button>
            <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
              <TabsList className="h-8">
                <TabsTrigger value="all" className="text-xs h-7">Todos</TabsTrigger>
                <TabsTrigger value="marked" className="text-xs h-7">Para prospectar</TabsTrigger>
              </TabsList>
            </Tabs>
            <Select value={tagFilter} onValueChange={setTagFilter}>
              <SelectTrigger className="h-8 w-44 text-xs">
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
                placeholder="Buscar nome ou e-mail..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-7 w-56 text-xs"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Lista */}
      <Card className="border-border">
        <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-muted/40">
          <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
          <span className="text-xs text-muted-foreground">
            Selecionar todos ({filteredLeads.length})
          </span>
        </div>
        <ScrollArea className="h-[460px]">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando…
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <Mail className="h-10 w-10 opacity-30" />
              <p className="text-sm">Nenhum contato com e-mail encontrado.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredLeads.map((lead) => {
                const lastTs = lead.last_prospected_at ? new Date(lead.last_prospected_at) : null;
                return (
                  <div key={lead.id} className="flex items-center gap-3 p-3 hover:bg-muted/40 transition-colors">
                    <Checkbox
                      checked={selected.has(lead.id)}
                      onCheckedChange={() => toggleOne(lead.id)}
                    />
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
                        <span className="truncate">✉️ {lead.email}</span>
                        {Array.isArray(lead.tags) && lead.tags.slice(0, 3).map((t) => (
                          <Badge key={t} variant="secondary" className="text-[10px] h-4">{t}</Badge>
                        ))}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openComposer(lead)}
                      disabled={!isConnected}
                    >
                      <Send className="h-3.5 w-3.5 mr-1" />
                      Enviar e-mail
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </Card>

      {/* Composer individual */}
      {composerLead && companyId && (
        <EmailComposer
          open={composerOpen}
          onOpenChange={(o) => {
            setComposerOpen(o);
            if (!o) loadLeads();
          }}
          companyId={companyId}
          defaultTo={composerLead.email || ""}
          leadId={composerLead.id}
          leadName={composerLead.name || undefined}
        />
      )}

      {/* Diálogo de campanha em massa */}
      <Dialog open={bulkOpen} onOpenChange={(o) => !bulkSending && setBulkOpen(o)}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-primary" />
              Campanha de e-mail em massa
            </DialogTitle>
            <DialogDescription>
              Enviando para <strong>{selected.size}</strong> contato(s) selecionado(s) a partir de {gmailEmail}.
              Use <code className="text-xs bg-muted px-1 rounded">{`{{nome}}`}</code> ou <code className="text-xs bg-muted px-1 rounded">{`{{primeiro_nome}}`}</code> para personalizar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Assunto</Label>
              <Input
                value={bulkSubject}
                onChange={(e) => setBulkSubject(e.target.value)}
                placeholder="Olá {{primeiro_nome}}, temos uma proposta para você"
                disabled={bulkSending}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Mensagem</Label>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">HTML</Label>
                  <Switch checked={bulkHtml} onCheckedChange={setBulkHtml} disabled={bulkSending} />
                </div>
              </div>
              <Textarea
                value={bulkBody}
                onChange={(e) => setBulkBody(e.target.value)}
                placeholder={bulkHtml ? "<p>Olá {{primeiro_nome}}...</p>" : "Olá {{primeiro_nome}},\n\nGostaria de apresentar..."}
                rows={10}
                className="resize-none font-mono text-sm"
                disabled={bulkSending}
              />
            </div>

            {bulkSending && (
              <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                Enviando… {bulkProgress.ok + bulkProgress.fail}/{bulkProgress.total} ({bulkProgress.ok} ok, {bulkProgress.fail} falhas)
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)} disabled={bulkSending}>
              Cancelar
            </Button>
            <Button onClick={runBulk} disabled={bulkSending || !isConnected}>
              {bulkSending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...</>
              ) : (
                <><Send className="h-4 w-4 mr-2" /> Enviar para {selected.size} contato(s)</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
