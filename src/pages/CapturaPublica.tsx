import { useParams } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, MessageCircle, Phone, Mail, MapPin, Globe, ChevronDown } from "lucide-react";

interface CaptureConfig {
  titulo?: string;
  descricao?: string;
  cor_primaria?: string;
  cor_secundaria?: string;
  logo_url?: string;
  mensagem_boas_vindas?: string;
  servicos?: Array<{ nome: string; descricao?: string; icone?: string; imagem_url?: string }>;
  perguntas?: Array<{ campo: string; label: string; tipo?: string; obrigatorio?: boolean }>;
  tag_automatica?: string;
  telefone_contato?: string;
  whatsapp?: string;
  email_contato?: string;
  endereco?: string;
  site?: string;
  redes_sociais?: { instagram?: string; facebook?: string; linkedin?: string };
}

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

export default function CapturaPublica() {
  const { companyId } = useParams<{ companyId: string }>();
  const [config, setConfig] = useState<CaptureConfig>({});
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [resolvedCompanyId, setResolvedCompanyId] = useState<string | null>(null);

  // Chat state
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [collectedData, setCollectedData] = useState<Record<string, string>>({});
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [chatMode, setChatMode] = useState<'questions' | 'freeform'>('questions');
  const [leadCreated, setLeadCreated] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const primaryColor = config.cor_primaria || '#8B5CF6';
  const secondaryColor = config.cor_secundaria || '#6D28D9';

  useEffect(() => {
    loadCompanyConfig();
  }, [companyId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadCompanyConfig = async () => {
    if (!companyId) { setNotFound(true); setLoading(false); return; }

    // Use SECURITY DEFINER RPC to allow anonymous public access
    const { data: rows, error } = await supabase
      .rpc('get_capture_page', { _identifier: companyId });

    if (error) {
      console.error('[CapturaPublica] RPC error:', error);
    }

    const data: any = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;

    if (!data) { setNotFound(true); setLoading(false); return; }

    setResolvedCompanyId(data.id);
    setCompanyName(data.name);
    const cfg = (data as any).capture_page_config as CaptureConfig || {};
    setConfig(cfg);
    setLoading(false);

    const welcome = cfg.mensagem_boas_vindas || `Olá! 👋 Bem-vindo(a) à ${data.name}. Como posso te ajudar?`;
    setMessages([{ role: 'assistant', content: welcome }]);

    if (cfg.perguntas && cfg.perguntas.length > 0) {
      setChatMode('questions');
      setTimeout(() => {
        setMessages(prev => [...prev, { role: 'assistant', content: cfg.perguntas![0].label }]);
      }, 800);
    } else {
      setChatMode('freeform');
    }
  };

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);

    if (chatMode === 'questions' && config.perguntas) {
      const perguntas = config.perguntas;
      const currentQ = perguntas[currentQuestionIdx];
      
      // Save answer
      const newData = { ...collectedData, [currentQ.campo]: userMsg };
      setCollectedData(newData);

      const nextIdx = currentQuestionIdx + 1;
      if (nextIdx < perguntas.length) {
        setCurrentQuestionIdx(nextIdx);
        setTimeout(() => {
          setMessages(prev => [...prev, { role: 'assistant', content: perguntas[nextIdx].label }]);
        }, 600);
      } else {
        // All questions answered - create lead
        await createLead(newData);
        setChatMode('freeform');
      }
    } else {
      // Freeform - call AI
      await callAI(userMsg);
    }
  };

  const createLead = async (data: Record<string, string>) => {
    if (leadCreated) return;
    setSending(true);

    try {
      const tag = config.tag_automatica || 'pagina-captura';
      const payload = {
        nome: data.nome || data.name || 'Visitante',
        telefone: data.telefone || data.phone || data.whatsapp,
        email: data.email,
        empresa: data.empresa || data.company,
        mensagem: Object.entries(data).map(([k, v]) => `${k}: ${v}`).join('\n'),
        origem: 'pagina-captura',
        company_slug: resolvedCompanyId || companyId,
        utm_source: 'capture-page',
        utm_medium: 'chat-ia',
      };

      const res = await supabase.functions.invoke('api-public-leads', {
        body: { ...payload, company_slug: resolvedCompanyId || companyId },
      });

      setLeadCreated(true);
      const successMsg = '✅ Obrigado! Suas informações foram recebidas com sucesso. Nossa equipe entrará em contato em breve!';
      setMessages(prev => [...prev, { role: 'assistant', content: successMsg }]);

      if (res.data?.success) {
        setTimeout(() => {
          setMessages(prev => [...prev, { role: 'assistant', content: 'Enquanto isso, posso te ajudar com mais alguma dúvida? 😊' }]);
        }, 1500);
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Houve um erro ao salvar seus dados. Por favor, tente novamente.' }]);
    }
    setSending(false);
  };

  const callAI = async (message: string) => {
    setSending(true);
    try {
      const history = messages.filter(m => m.role !== 'assistant' || !m.content.startsWith('✅')).slice(-10);
      
      const res = await supabase.functions.invoke('api-public-ia', {
        body: {
          message,
          company_slug: resolvedCompanyId || companyId,
          context: 'atendimento',
          history,
          nome: collectedData.nome,
          telefone: collectedData.telefone,
          email: collectedData.email,
        },
      });

      const reply = res.data?.response || 'Desculpe, não consegui processar sua mensagem.';
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Erro ao conectar. Tente novamente.' }]);
    }
    setSending(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${primaryColor}22, ${secondaryColor}11)` }}>
        <div className="animate-spin h-10 w-10 border-4 border-t-transparent rounded-full" style={{ borderColor: primaryColor, borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold text-gray-800">Página não encontrada</h1>
          <p className="text-gray-500">Esta página de captura não existe ou foi desativada.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md border-b" style={{ background: `${primaryColor}ee`, borderColor: `${primaryColor}44` }}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          {config.logo_url && (
            <img src={config.logo_url} alt={companyName} className="h-10 w-10 rounded-lg object-cover bg-white p-0.5" />
          )}
          <span className="text-white font-bold text-lg">{companyName}</span>
          <div className="ml-auto flex items-center gap-3">
            {config.telefone_contato && (
              <a href={`tel:${config.telefone_contato}`} className="text-white/80 hover:text-white text-sm flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" /> {config.telefone_contato}
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}>
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-white rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-6xl mx-auto px-4 py-20 text-center text-white">
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4 leading-tight">
            {config.titulo || `Bem-vindo à ${companyName}`}
          </h1>
          <p className="text-lg md:text-xl opacity-90 max-w-2xl mx-auto mb-8">
            {config.descricao || 'Conheça nossos serviços e entre em contato. Estamos prontos para atender você!'}
          </p>
          <Button
            size="lg"
            onClick={() => { setChatOpen(true); document.getElementById('chat-section')?.scrollIntoView({ behavior: 'smooth' }); }}
            className="bg-white hover:bg-gray-100 font-bold text-lg px-8 py-6 rounded-2xl shadow-xl"
            style={{ color: primaryColor }}
          >
            <MessageCircle className="h-5 w-5 mr-2" />
            Fale Conosco
          </Button>
          <div className="mt-6 animate-bounce">
            <ChevronDown className="h-6 w-6 mx-auto opacity-60" />
          </div>
        </div>
      </section>

      {/* Services/Portfolio */}
      {config.servicos && config.servicos.length > 0 && (
        <section className="py-16 bg-white">
          <div className="max-w-6xl mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-10 text-gray-800">Nossos Serviços</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {config.servicos.map((s, i) => (
                <div key={i} className="group p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1" style={{ borderTopColor: primaryColor, borderTopWidth: '3px' }}>
                  {s.imagem_url && (
                    <img src={s.imagem_url} alt={s.nome} className="w-full h-40 object-cover rounded-xl mb-4" />
                  )}
                  <h3 className="font-bold text-lg mb-2 text-gray-800">{s.nome}</h3>
                  {s.descricao && <p className="text-sm text-gray-500">{s.descricao}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Chat Section */}
      <section id="chat-section" className="py-16" style={{ background: `linear-gradient(180deg, #f8f9fa, ${primaryColor}08)` }}>
        <div className="max-w-2xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-2 text-gray-800">Converse Conosco</h2>
          <p className="text-center text-gray-500 mb-8">Tire suas dúvidas ou solicite um atendimento</p>

          <div className="bg-white rounded-2xl shadow-xl border overflow-hidden" style={{ borderColor: `${primaryColor}22` }}>
            {/* Chat messages */}
            <div className="h-[400px] overflow-y-auto p-4 space-y-3" style={{ background: `${primaryColor}05` }}>
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'text-white rounded-br-md'
                        : 'bg-gray-100 text-gray-800 rounded-bl-md'
                    }`}
                    style={msg.role === 'user' ? { background: primaryColor } : {}}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-md">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="border-t p-3 flex gap-2">
              <Input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder="Digite sua mensagem..."
                className="flex-1 border-0 focus-visible:ring-1 rounded-xl"
                style={{ '--tw-ring-color': primaryColor } as any}
                disabled={sending}
              />
              <Button
                onClick={handleSend}
                disabled={sending || !input.trim()}
                size="icon"
                className="rounded-xl shrink-0"
                style={{ background: primaryColor }}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 text-white" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}>
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                {config.logo_url && <img src={config.logo_url} alt="" className="h-8 w-8 rounded bg-white p-0.5" />}
                <span className="font-bold text-lg">{companyName}</span>
              </div>
              <p className="text-sm opacity-80">{config.descricao?.substring(0, 120)}</p>
            </div>
            <div className="space-y-2">
              <h4 className="font-bold mb-3">Contato</h4>
              {config.telefone_contato && (
                <a href={`tel:${config.telefone_contato}`} className="flex items-center gap-2 text-sm opacity-80 hover:opacity-100">
                  <Phone className="h-4 w-4" /> {config.telefone_contato}
                </a>
              )}
              {config.whatsapp && (
                <a href={`https://wa.me/${config.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener" className="flex items-center gap-2 text-sm opacity-80 hover:opacity-100">
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </a>
              )}
              {config.email_contato && (
                <a href={`mailto:${config.email_contato}`} className="flex items-center gap-2 text-sm opacity-80 hover:opacity-100">
                  <Mail className="h-4 w-4" /> {config.email_contato}
                </a>
              )}
              {config.endereco && (
                <p className="flex items-center gap-2 text-sm opacity-80">
                  <MapPin className="h-4 w-4" /> {config.endereco}
                </p>
              )}
            </div>
            <div className="space-y-2">
              {config.site && (
                <a href={config.site} target="_blank" rel="noopener" className="flex items-center gap-2 text-sm opacity-80 hover:opacity-100">
                  <Globe className="h-4 w-4" /> {config.site}
                </a>
              )}
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-white/20 text-center text-sm opacity-60">
            © {new Date().getFullYear()} {companyName}. Todos os direitos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
}
