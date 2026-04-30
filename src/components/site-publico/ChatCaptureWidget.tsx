import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, MessageCircle, X, Sparkles, CheckCircle2, Loader2 } from "lucide-react";
import { SiteTheme } from "@/lib/siteTemplates";
import ReactMarkdown from "react-markdown";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  companyId: string;
  companyName: string;
  theme: SiteTheme;
  config: {
    sugestoes_chat?: string[];
    tag_automatica?: string;
    whatsapp_flutuante_mensagem?: string;
    company_slug?: string;
    bot_ia_site?: {
      ativo?: boolean;
      nome_bot?: string;
      avatar_url?: string;
      saudacao?: string;
      sugestoes_iniciais?: string[];
      delay_resposta_ms?: number;
      limite_mensagens?: number;
    };
  };
}

type Classificacao = "quente" | "morno" | "frio" | "curioso";

export function ChatCaptureWidget({
  open,
  onClose,
  companyId,
  companyName,
  theme,
  config,
}: Props) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sessionId] = useState<string>(() =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `s-${Date.now()}`
  );
  const [classificacao, setClassificacao] = useState<Classificacao | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [transferido, setTransferido] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const slug = (config as any).company_slug || companyName?.toLowerCase().replace(/\s+/g, "-");

  const botCfg = config.bot_ia_site || {};
  const botName = botCfg.nome_bot || `atendimento da ${companyName}`;

  useEffect(() => {
    if (open && messages.length === 0) {
      const greeting =
        botCfg.saudacao ||
        config.whatsapp_flutuante_mensagem ||
        `Olá! 👋 Sou ${botCfg.nome_bot ? botCfg.nome_bot + ', da ' + companyName : 'o atendimento virtual da ' + companyName}. Como posso te ajudar hoje?`;
      setMessages([{ role: "assistant", content: greeting }]);
    }
  }, [open]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendInput = async (text: string) => {
    if (!text.trim() || sending) return;
    setSending(true);
    const userMsg: ChatMsg = { role: "user", content: text };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");

    try {
      const { data, error } = await supabase.functions.invoke("api-public-ia", {
        body: {
          message: text,
          session_id: sessionId,
          company_slug: slug,
          context: "auto",
          history: nextMessages.slice(-10),
        },
      });

      if (error) throw error;

      const reply: string =
        data?.response || "Desculpe, não consegui responder agora. Tente novamente.";
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);

      if (data?.qualificacao) {
        if (data.qualificacao.classificacao) {
          setClassificacao(data.qualificacao.classificacao as Classificacao);
        }
        if (typeof data.qualificacao.score === "number") {
          setScore(data.qualificacao.score);
        }
      }

      if (data?.transferir_humano && !transferido) {
        setTransferido(true);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "✅ Perfeito! Já passei suas informações para nosso time comercial. Em instantes alguém entrará em contato para dar continuidade.",
          },
        ]);
      }
    } catch (e) {
      console.error("Erro chat IA:", e);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Tive um problema técnico agora. Pode tentar de novo ou nos chamar pelo WhatsApp?",
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => onClose()}
        className="fixed bottom-6 right-6 w-16 h-16 rounded-full shadow-2xl flex items-center justify-center text-white z-50 hover:scale-110 transition"
        style={{ background: theme.primary }}
        aria-label="Abrir chat"
      >
        <MessageCircle className="w-7 h-7" />
      </button>
    );
  }

  const classifColor: Record<Classificacao, string> = {
    quente: "bg-red-100 text-red-700 border-red-200",
    morno: "bg-amber-100 text-amber-700 border-amber-200",
    frio: "bg-sky-100 text-sky-700 border-sky-200",
    curioso: "bg-slate-100 text-slate-600 border-slate-200",
  };

  return (
    <div className="fixed bottom-6 right-6 w-full max-w-sm h-[620px] max-h-[85vh] bg-white rounded-2xl shadow-2xl flex flex-col z-50 border overflow-hidden">
      {/* Header */}
      <div
        className="p-4 text-white flex items-center justify-between"
        style={{ background: theme.primary }}
      >
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold leading-tight">{companyName}</div>
            <div className="text-xs opacity-90 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
              Assistente IA online
            </div>
          </div>
        </div>
        <button onClick={onClose} className="hover:opacity-70" aria-label="Fechar">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Status de qualificação */}
      {(classificacao || transferido) && (
        <div className="px-3 py-2 border-b bg-slate-50 flex items-center gap-2 text-xs">
          {classificacao && (
            <span
              className={`px-2 py-0.5 rounded-full border font-medium ${classifColor[classificacao]}`}
            >
              Lead {classificacao}
              {score != null ? ` · ${score}/100` : ""}
            </span>
          )}
          {transferido && (
            <span className="px-2 py-0.5 rounded-full border bg-green-100 text-green-700 border-green-200 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Encaminhado ao time
            </span>
          )}
        </div>
      )}

      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm ${
                m.role === "user" ? "text-white" : "bg-white border text-slate-800"
              }`}
              style={m.role === "user" ? { background: theme.primary } : {}}
            >
              {m.role === "assistant" ? (
                <div className="prose prose-sm max-w-none [&>*]:my-1 [&>p]:leading-snug">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              ) : (
                m.content
              )}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Loader2 className="w-3 h-3 animate-spin" />
            digitando...
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Sugestões iniciais */}
      {(() => {
        const sugestoes = botCfg.sugestoes_iniciais?.length ? botCfg.sugestoes_iniciais : config.sugestoes_chat;
        return messages.length <= 1 && sugestoes && sugestoes.length > 0 && (
          <div className="px-3 pt-2 flex flex-wrap gap-1 border-t bg-white">
            {sugestoes.map((s, i) => (
              <button
                key={i}
                onClick={() => sendInput(s)}
                className="text-xs px-2 py-1 rounded-full border hover:bg-slate-100"
              >
                {s}
              </button>
            ))}
          </div>
        );
      })()}

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendInput(input);
        }}
        className="p-3 border-t flex gap-2 bg-white"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Digite sua mensagem..."
          disabled={sending}
        />
        <Button
          type="submit"
          size="icon"
          disabled={sending || !input.trim()}
          style={{ background: theme.primary }}
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </form>
      <div className="text-[10px] text-center text-slate-400 pb-2 bg-white">
        Powered by IA · Suas informações estão seguras
      </div>
    </div>
  );
}
