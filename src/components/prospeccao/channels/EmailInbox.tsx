import { useEffect, useRef, useState } from "react";
import { Loader2, RefreshCw, Inbox, Mail, Send, ArrowLeft, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ThreadSummary {
  id: string;
  snippet: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  internalDate?: string;
  unread: boolean;
  messageCount: number;
}

interface ThreadMessage {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  text: string;
  html: string;
  fromMe: boolean;
  unread: boolean;
  messageId?: string;
  references?: string;
}

interface Props {
  companyId: string;
  gmailEmail: string | null;
  isConnected: boolean;
}

const parseFrom = (raw: string) => {
  const m = raw.match(/^\s*"?([^"<]*)"?\s*<?([^>]*)>?\s*$/);
  const name = (m?.[1] || "").trim();
  const email = (m?.[2] || raw).trim();
  return { name: name || email, email };
};

const fmtDate = (d: string | undefined) => {
  if (!d) return "";
  const dt = new Date(isNaN(Number(d)) ? d : Number(d));
  if (isNaN(dt.getTime())) return d;
  const today = new Date();
  if (dt.toDateString() === today.toDateString()) {
    return dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
};

export function EmailInbox({ companyId, gmailEmail, isConnected }: Props) {
  const [folder, setFolder] = useState<"inbox" | "sent">("inbox");
  const [search, setSearch] = useState("");
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [thread, setThread] = useState<ThreadMessage[] | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadThreads = async () => {
    if (!isConnected) return;
    setLoading(true);
    const q = (folder === "sent" ? "in:sent " : "in:inbox ") + (search.trim() || "");
    const { data, error } = await supabase.functions.invoke("gmail-inbox", {
      body: { action: "list", company_id: companyId, q, max: 30 },
    });
    setLoading(false);
    if (error || (data as any)?.error) {
      toast.error("Erro ao carregar caixa: " + (error?.message || (data as any)?.error));
      return;
    }
    setThreads(((data as any).threads || []) as ThreadSummary[]);
  };

  const loadThread = async (id: string) => {
    setSelectedId(id);
    setThread(null);
    setLoadingThread(true);
    const { data, error } = await supabase.functions.invoke("gmail-inbox", {
      body: { action: "thread", company_id: companyId, thread_id: id },
    });
    setLoadingThread(false);
    if (error || (data as any)?.error) {
      toast.error("Erro ao abrir conversa: " + (error?.message || (data as any)?.error));
      return;
    }
    setThread(((data as any).messages || []) as ThreadMessage[]);
    // marcar como lido localmente
    setThreads((prev) => prev.map((t) => (t.id === id ? { ...t, unread: false } : t)));
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const sendReply = async () => {
    if (!thread || thread.length === 0 || !reply.trim()) return;
    const last = thread[thread.length - 1];
    const { email: replyTo } = parseFrom(last.fromMe ? last.to : last.from);
    const subj = last.subject?.toLowerCase().startsWith("re:") ? last.subject : `Re: ${last.subject || ""}`;
    setSending(true);
    const { data, error } = await supabase.functions.invoke("enviar-email-gmail", {
      body: {
        company_id: companyId,
        to: replyTo,
        subject: subj,
        body: reply,
        is_html: false,
        thread_id: last.threadId,
        in_reply_to: last.messageId,
        references: [last.references, last.messageId].filter(Boolean).join(" "),
      },
    });
    setSending(false);
    if (error || (data as any)?.error) {
      toast.error("Falha ao enviar: " + (error?.message || (data as any)?.error));
      return;
    }
    toast.success("Resposta enviada");
    setReply("");
    loadThread(last.threadId);
  };

  useEffect(() => {
    if (companyId && isConnected) loadThreads();
    // eslint-disable-next-line
  }, [companyId, isConnected, folder]);

  if (!isConnected) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        <Mail className="h-10 w-10 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Conecte o Gmail nas Configurações para acessar sua caixa de entrada.</p>
      </Card>
    );
  }

  return (
    <Card className="border-border overflow-hidden">
      <div className="flex items-center justify-between gap-2 p-3 border-b border-border bg-muted/30 flex-wrap">
        <div className="flex items-center gap-2">
          <Inbox className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Caixa de e-mails</span>
          {gmailEmail && <Badge variant="outline" className="text-[10px]">{gmailEmail}</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={folder} onValueChange={(v) => { setSelectedId(null); setThread(null); setFolder(v as any); }}>
            <TabsList className="h-8">
              <TabsTrigger value="inbox" className="text-xs h-7">Recebidos</TabsTrigger>
              <TabsTrigger value="sent" className="text-xs h-7">Enviados</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative">
            <Search className="h-3 w-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadThreads()}
              placeholder="Buscar..."
              className="h-8 pl-7 w-44 text-xs"
            />
          </div>
          <Button size="sm" variant="outline" onClick={loadThreads} disabled={loading}>
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] h-[560px]">
        {/* Lista de threads */}
        <div className={cn("border-r border-border", selectedId && "hidden md:block")}>
          <ScrollArea className="h-[560px]">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando…
              </div>
            ) : threads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                <Inbox className="h-10 w-10 opacity-30" />
                <p className="text-sm">Nenhuma conversa.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {threads.map((t) => {
                  const who = parseFrom(folder === "sent" ? t.to : t.from);
                  const active = selectedId === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => loadThread(t.id)}
                      className={cn(
                        "w-full text-left p-3 hover:bg-muted/50 transition-colors flex flex-col gap-1",
                        active && "bg-muted",
                        t.unread && "bg-primary/5",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn("text-sm truncate", t.unread && "font-semibold")}>
                          {who.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0">{fmtDate(t.internalDate || t.date)}</span>
                      </div>
                      <div className={cn("text-xs truncate", t.unread ? "font-medium" : "text-muted-foreground")}>
                        {t.subject || "(sem assunto)"}
                        {t.messageCount > 1 && (
                          <span className="ml-1 text-muted-foreground">({t.messageCount})</span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">{t.snippet}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Conversa */}
        <div className={cn("flex flex-col h-[560px]", !selectedId && "hidden md:flex")}>
          {!selectedId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2">
              <Mail className="h-10 w-10 opacity-30" />
              <p className="text-sm">Selecione uma conversa para visualizar</p>
            </div>
          ) : loadingThread ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando…
            </div>
          ) : (
            <>
              <div className="p-3 border-b border-border flex items-center gap-2">
                <Button size="icon" variant="ghost" className="md:hidden h-7 w-7" onClick={() => { setSelectedId(null); setThread(null); }}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{thread?.[0]?.subject || "(sem assunto)"}</p>
                  <p className="text-xs text-muted-foreground">{thread?.length || 0} mensagem(s)</p>
                </div>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-3">
                  {thread?.map((m) => {
                    const who = parseFrom(m.from);
                    return (
                      <div
                        key={m.id}
                        className={cn(
                          "flex flex-col max-w-[85%] rounded-lg p-3 border",
                          m.fromMe
                            ? "ml-auto bg-primary/10 border-primary/20"
                            : "mr-auto bg-muted border-border",
                        )}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs font-semibold truncate">
                            {m.fromMe ? "Você" : who.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground shrink-0">{fmtDate(m.internalDate || m.date)}</span>
                        </div>
                        {m.html ? (
                          <div
                            className="text-sm prose prose-sm max-w-none dark:prose-invert [&_a]:text-primary"
                            dangerouslySetInnerHTML={{ __html: m.html }}
                          />
                        ) : (
                          <pre className="text-sm whitespace-pre-wrap font-sans break-words">{m.text || m.subject}</pre>
                        )}
                      </div>
                    );
                  })}
                  <div ref={bottomRef} />
                </div>
              </ScrollArea>
              <div className="p-3 border-t border-border bg-muted/20">
                <div className="flex gap-2 items-end">
                  <Textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Escreva sua resposta..."
                    rows={2}
                    className="resize-none text-sm"
                    disabled={sending}
                  />
                  <Button onClick={sendReply} disabled={sending || !reply.trim()}>
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
