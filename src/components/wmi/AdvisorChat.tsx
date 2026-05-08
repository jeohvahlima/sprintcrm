import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Sparkles, Loader2, User, Bot } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import type { WMIScore } from "@/hooks/useWMI";
import { toast } from "sonner";

interface Msg { role: "user" | "assistant"; content: string }

const SUGGESTIONS = [
  "Como melhorar minha taxa de conversão?",
  "Qual deve ser meu primeiro passo para estruturar prospecção?",
  "Como montar um time de SDR?",
  "Quais KPIs comerciais devo acompanhar?",
];

export function AdvisorChat({ score }: { score?: WMIScore }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    if (!text.trim() || loading) return;
    const userMsg: Msg = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("advisor-ai", {
        body: { mode: "chat", messages: next, assessment: score },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setMessages((m) => [...m, { role: "assistant", content: data.content || "Sem resposta." }]);
    } catch (e: any) {
      toast.error(e.message || "Erro ao consultar Advisor IA");
      setMessages((m) => m.slice(0, -1));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </div>
          GROW Advisor IA
          <span className="text-xs font-normal text-muted-foreground ml-auto">Consultor comercial</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div ref={scrollRef} className="h-80 overflow-y-auto space-y-3 pr-2">
          {messages.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8 space-y-3">
              <Bot className="h-10 w-10 mx-auto opacity-30" />
              <p>Pergunte qualquer coisa sobre estruturação comercial.</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {SUGGESTIONS.map((s) => (
                  <Button key={s} size="sm" variant="outline" className="text-xs" onClick={() => send(s)}>
                    {s}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : ""}`}>
                {m.role === "assistant" && (
                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                }`}>
                  {m.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none [&>*]:my-1">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    m.content
                  )}
                </div>
                {m.role === "user" && (
                  <div className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center shrink-0">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            ))
          )}
          {loading && (
            <div className="flex gap-2 items-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Advisor pensando…
            </div>
          )}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex gap-2">
          <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Pergunte ao Advisor IA…" disabled={loading} />
          <Button type="submit" disabled={loading || !input.trim()} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
