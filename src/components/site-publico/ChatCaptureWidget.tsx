import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, MessageCircle, X } from "lucide-react";
import { SiteTheme } from "@/lib/siteTemplates";

interface ChatMsg { role: 'user' | 'assistant'; content: string; }

interface Props {
  open: boolean;
  onClose: () => void;
  companyId: string;
  companyName: string;
  theme: SiteTheme;
  config: {
    perguntas?: Array<{ campo: string; label: string; tipo?: string; obrigatorio?: boolean }>;
    sugestoes_chat?: string[];
    tag_automatica?: string;
    whatsapp_flutuante_mensagem?: string;
  };
}

const DEFAULT_PERGUNTAS = [
  { campo: 'nome', label: 'Qual seu nome?', obrigatorio: true },
  { campo: 'telefone', label: 'Qual seu WhatsApp?', tipo: 'tel', obrigatorio: true },
  { campo: 'email', label: 'Qual seu e-mail?', tipo: 'email', obrigatorio: false },
];

export function ChatCaptureWidget({ open, onClose, companyId, companyName, theme, config }: Props) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [collected, setCollected] = useState<Record<string, string>>({});
  const [questionIdx, setQuestionIdx] = useState(0);
  const [leadCreated, setLeadCreated] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const perguntas = config.perguntas?.length ? config.perguntas : DEFAULT_PERGUNTAS;

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([
        { role: 'assistant', content: config.whatsapp_flutuante_mensagem || `Olá! Bem-vindo à ${companyName}. Vou te ajudar.` },
        { role: 'assistant', content: perguntas[0].label },
      ]);
    }
  }, [open]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const sendInput = async (text: string) => {
    if (!text.trim() || sending) return;
    setSending(true);
    setMessages(p => [...p, { role: 'user', content: text }]);
    setInput('');

    if (!leadCreated && questionIdx < perguntas.length) {
      const q = perguntas[questionIdx];
      const newCollected = { ...collected, [q.campo]: text };
      setCollected(newCollected);
      const nextIdx = questionIdx + 1;

      if (nextIdx < perguntas.length) {
        setQuestionIdx(nextIdx);
        setMessages(p => [...p, { role: 'assistant', content: perguntas[nextIdx].label }]);
        setSending(false);
        return;
      }

      // Criar lead
      try {
        await supabase.functions.invoke('api-public-leads', {
          body: {
            company_id: companyId,
            nome: newCollected.nome || 'Visitante',
            telefone: newCollected.telefone,
            email: newCollected.email,
            origem: 'site-institucional',
            tag_automatica: config.tag_automatica || 'site-institucional',
          },
        });
        setLeadCreated(true);
        setMessages(p => [...p, { role: 'assistant', content: `Perfeito, ${newCollected.nome}! Recebemos seus dados. Em breve entraremos em contato. 🎉` }]);
      } catch (e) {
        setMessages(p => [...p, { role: 'assistant', content: 'Recebemos sua mensagem!' }]);
      }
      setSending(false);
      return;
    }

    setMessages(p => [...p, { role: 'assistant', content: 'Obrigado! Em breve entraremos em contato.' }]);
    setSending(false);
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

  return (
    <div className="fixed bottom-6 right-6 w-full max-w-sm h-[600px] max-h-[80vh] bg-white rounded-2xl shadow-2xl flex flex-col z-50 border">
      <div className="p-4 rounded-t-2xl text-white flex items-center justify-between" style={{ background: theme.primary }}>
        <div>
          <div className="font-bold">{companyName}</div>
          <div className="text-xs opacity-90">Online agora</div>
        </div>
        <button onClick={onClose} className="hover:opacity-70"><X className="w-5 h-5" /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${m.role === 'user' ? 'text-white' : 'bg-white border'}`}
              style={m.role === 'user' ? { background: theme.primary } : {}}
            >
              {m.content}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {leadCreated && config.sugestoes_chat && config.sugestoes_chat.length > 0 && (
        <div className="px-3 pt-2 flex flex-wrap gap-1 border-t">
          {config.sugestoes_chat.map((s, i) => (
            <button key={i} onClick={() => sendInput(s)} className="text-xs px-2 py-1 rounded-full border hover:bg-slate-100">{s}</button>
          ))}
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); sendInput(input); }} className="p-3 border-t flex gap-2">
        <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Digite sua mensagem..." disabled={sending} />
        <Button type="submit" size="icon" disabled={sending || !input.trim()} style={{ background: theme.primary }}>
          <Send className="w-4 h-4" />
        </Button>
      </form>
    </div>
  );
}
