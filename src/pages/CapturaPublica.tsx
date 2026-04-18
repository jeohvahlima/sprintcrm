import { useParams, useSearchParams } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, MessageCircle, Phone, Mail, MapPin, Globe, ChevronDown, Star, Plus, Minus } from "lucide-react";

interface Depoimento {
  nome: string;
  texto: string;
  estrelas?: number;
  foto_url?: string;
}

interface FaqItem {
  pergunta: string;
  resposta: string;
}

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
  // Novos campos
  depoimentos?: Depoimento[];
  faq?: FaqItem[];
  urgencia_ativa?: boolean;
  urgencia_texto?: string;
  whatsapp_flutuante_ativo?: boolean;
  whatsapp_flutuante_mensagem?: string;
  sugestoes_chat?: string[];
  og_titulo?: string;
  og_descricao?: string;
  og_imagem_url?: string;
  // Tracking
  facebook_pixel_id?: string;
  google_analytics_id?: string;
  google_tag_manager_id?: string;
  google_ads_conversion_id?: string;
  google_ads_conversion_label?: string;
}

declare global {
  interface Window {
    fbq?: any;
    _fbq?: any;
    gtag?: any;
    dataLayer?: any[];
  }
}

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

export default function CapturaPublica() {
  const { companyId } = useParams<{ companyId: string }>();
  const [searchParams] = useSearchParams();
  const [config, setConfig] = useState<CaptureConfig>({});
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [resolvedCompanyId, setResolvedCompanyId] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

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

  // UTM tracking
  const utmParams = {
    utm_source: searchParams.get('utm_source') || 'capture-page',
    utm_medium: searchParams.get('utm_medium') || 'chat-ia',
    utm_campaign: searchParams.get('utm_campaign') || undefined,
    utm_content: searchParams.get('utm_content') || undefined,
    utm_term: searchParams.get('utm_term') || undefined,
  };

  useEffect(() => {
    loadCompanyConfig();
  }, [companyId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Open Graph & SEO dinâmico
  useEffect(() => {
    if (!companyName) return;
    const titulo = config.og_titulo || config.titulo || `${companyName} — Fale conosco`;
    const descricao = config.og_descricao || config.descricao || `Entre em contato com ${companyName}`;
    const imagem = config.og_imagem_url || config.logo_url || '';

    document.title = titulo;

    const setMeta = (selector: string, attr: string, value: string) => {
      let tag = document.querySelector(selector) as HTMLMetaElement | null;
      if (!tag) {
        tag = document.createElement('meta');
        const [k, v] = selector.replace('meta[', '').replace(']', '').split('=');
        tag.setAttribute(k, v.replace(/"/g, ''));
        document.head.appendChild(tag);
      }
      tag.setAttribute(attr, value);
    };

    setMeta('meta[name="description"]', 'content', descricao);
    setMeta('meta[property="og:title"]', 'content', titulo);
    setMeta('meta[property="og:description"]', 'content', descricao);
    if (imagem) setMeta('meta[property="og:image"]', 'content', imagem);
    setMeta('meta[property="og:type"]', 'content', 'website');
    setMeta('meta[name="twitter:card"]', 'content', 'summary_large_image');
    setMeta('meta[name="twitter:title"]', 'content', titulo);
    setMeta('meta[name="twitter:description"]', 'content', descricao);
    if (imagem) setMeta('meta[name="twitter:image"]', 'content', imagem);
  }, [config, companyName]);

  // Tracking pixels (FB Pixel, GA4, GTM, Google Ads)
  useEffect(() => {
    if (!config) return;

    // Facebook Pixel
    if (config.facebook_pixel_id && !window.fbq) {
      (function(f: any, b, e, v, n?: any, t?: any, s?: any) {
        if (f.fbq) return; n = f.fbq = function() {
          n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
        };
        if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0';
        n.queue = []; t = b.createElement(e); t.async = !0;
        t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
      })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
      window.fbq('init', config.facebook_pixel_id);
      window.fbq('track', 'PageView');
    } else if (config.facebook_pixel_id && window.fbq) {
      window.fbq('track', 'PageView');
    }

    // Google Analytics 4 / Google Ads via gtag
    const gaId = config.google_analytics_id;
    const adsId = config.google_ads_conversion_id;
    const gtagIds = [gaId, adsId].filter(Boolean) as string[];
    if (gtagIds.length > 0 && !window.gtag) {
      const s = document.createElement('script');
      s.async = true;
      s.src = `https://www.googletagmanager.com/gtag/js?id=${gtagIds[0]}`;
      document.head.appendChild(s);
      window.dataLayer = window.dataLayer || [];
      window.gtag = function() { window.dataLayer!.push(arguments); };
      window.gtag('js', new Date());
      gtagIds.forEach(id => window.gtag('config', id));
    }

    // Google Tag Manager
    if (config.google_tag_manager_id && !document.getElementById('gtm-script')) {
      const s = document.createElement('script');
      s.id = 'gtm-script';
      s.innerHTML = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${config.google_tag_manager_id}');`;
      document.head.appendChild(s);
    }
  }, [config.facebook_pixel_id, config.google_analytics_id, config.google_tag_manager_id, config.google_ads_conversion_id]);

  const fireConversionEvents = (leadData: Record<string, string>) => {
    try {
      // Facebook Pixel Lead event
      if (window.fbq) {
        window.fbq('track', 'Lead', {
          content_name: config.tag_automatica || 'pagina-captura',
        });
      }
      // Google Analytics generate_lead
      if (window.gtag && config.google_analytics_id) {
        window.gtag('event', 'generate_lead', {
          send_to: config.google_analytics_id,
        });
      }
      // Google Ads conversion
      if (window.gtag && config.google_ads_conversion_id && config.google_ads_conversion_label) {
        window.gtag('event', 'conversion', {
          send_to: `${config.google_ads_conversion_id}/${config.google_ads_conversion_label}`,
        });
      }
      // GTM dataLayer
      if (window.dataLayer) {
        window.dataLayer.push({ event: 'lead_captured', lead_name: leadData.nome });
      }
    } catch (e) {
      console.error('[Tracking] erro:', e);
    }
  };

  const loadCompanyConfig = async () => {
    if (!companyId) { setNotFound(true); setLoading(false); return; }

    const { data: rows, error } = await supabase
      .rpc('get_capture_page', { _identifier: companyId });

    if (error) console.error('[CapturaPublica] RPC error:', error);

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

  const sendMessage = async (text: string) => {
    if (!text.trim() || sending) return;
    setMessages(prev => [...prev, { role: 'user', content: text }]);

    if (chatMode === 'questions' && config.perguntas) {
      const perguntas = config.perguntas;
      const currentQ = perguntas[currentQuestionIdx];
      const newData = { ...collectedData, [currentQ.campo]: text };
      setCollectedData(newData);

      const nextIdx = currentQuestionIdx + 1;
      if (nextIdx < perguntas.length) {
        setCurrentQuestionIdx(nextIdx);
        setTimeout(() => {
          setMessages(prev => [...prev, { role: 'assistant', content: perguntas[nextIdx].label }]);
        }, 600);
      } else {
        await createLead(newData);
        setChatMode('freeform');
      }
    } else {
      await callAI(text);
    }
  };

  const handleSend = async () => {
    const userMsg = input.trim();
    if (!userMsg) return;
    setInput('');
    await sendMessage(userMsg);
  };

  const createLead = async (data: Record<string, string>) => {
    if (leadCreated) return;
    setSending(true);

    try {
      const payload = {
        nome: data.nome || data.name || 'Visitante',
        telefone: data.telefone || data.phone || data.whatsapp,
        email: data.email,
        empresa: data.empresa || data.company,
        mensagem: Object.entries(data).map(([k, v]) => `${k}: ${v}`).join('\n'),
        origem: 'pagina-captura',
        company_slug: resolvedCompanyId || companyId,
        ...utmParams,
      };

      const res = await supabase.functions.invoke('api-public-leads', {
        body: { ...payload, company_slug: resolvedCompanyId || companyId },
      });

      setLeadCreated(true);
      fireConversionEvents(data);
      setMessages(prev => [...prev, { role: 'assistant', content: '✅ Obrigado! Suas informações foram recebidas com sucesso. Nossa equipe entrará em contato em breve!' }]);

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

  const whatsappLink = config.whatsapp
    ? `https://wa.me/${config.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(config.whatsapp_flutuante_mensagem || `Olá! Vim pelo site da ${companyName}.`)}`
    : null;

  return (
    <div className="min-h-screen" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Barra de urgência */}
      {config.urgencia_ativa && config.urgencia_texto && (
        <div className="text-white text-center py-2 px-4 text-sm font-medium" style={{ background: secondaryColor }}>
          🔥 {config.urgencia_texto}
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-md border-b" style={{ background: `${primaryColor}ee`, borderColor: `${primaryColor}44` }}>
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

      {/* Depoimentos */}
      {config.depoimentos && config.depoimentos.length > 0 && (
        <section className="py-16" style={{ background: `${primaryColor}06` }}>
          <div className="max-w-6xl mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-2 text-gray-800">O que dizem nossos clientes</h2>
            <p className="text-center text-gray-500 mb-10">Avaliações reais de quem já confiou em nós</p>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {config.depoimentos.map((d, i) => (
                <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                  <div className="flex gap-1 mb-3">
                    {Array.from({ length: d.estrelas || 5 }).map((_, k) => (
                      <Star key={k} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-sm text-gray-600 italic mb-4">"{d.texto}"</p>
                  <div className="flex items-center gap-3">
                    {d.foto_url ? (
                      <img src={d.foto_url} alt={d.nome} className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold" style={{ background: primaryColor }}>
                        {d.nome.charAt(0)}
                      </div>
                    )}
                    <span className="font-semibold text-gray-800 text-sm">{d.nome}</span>
                  </div>
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
            <div className="h-[400px] overflow-y-auto p-4 space-y-3" style={{ background: `${primaryColor}05` }}>
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      msg.role === 'user' ? 'text-white rounded-br-md' : 'bg-gray-100 text-gray-800 rounded-bl-md'
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

            {/* Sugestões rápidas */}
            {config.sugestoes_chat && config.sugestoes_chat.length > 0 && messages.length <= 2 && (
              <div className="px-3 pt-3 flex flex-wrap gap-2 border-t">
                {config.sugestoes_chat.filter(s => s.trim()).map((s, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(s)}
                    disabled={sending}
                    className="text-xs px-3 py-1.5 rounded-full border transition-colors hover:text-white disabled:opacity-50"
                    style={{
                      borderColor: primaryColor,
                      color: primaryColor,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = primaryColor; e.currentTarget.style.color = '#fff'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = primaryColor; }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

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

      {/* FAQ */}
      {config.faq && config.faq.length > 0 && (
        <section className="py-16 bg-white">
          <div className="max-w-3xl mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-2 text-gray-800">Perguntas Frequentes</h2>
            <p className="text-center text-gray-500 mb-10">Tire suas principais dúvidas rapidamente</p>
            <div className="space-y-3">
              {config.faq.map((item, i) => (
                <div key={i} className="border border-gray-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-gray-50"
                  >
                    <span className="font-semibold text-gray-800">{item.pergunta}</span>
                    {openFaq === i ? <Minus className="h-4 w-4 shrink-0" style={{ color: primaryColor }} /> : <Plus className="h-4 w-4 shrink-0" style={{ color: primaryColor }} />}
                  </button>
                  {openFaq === i && (
                    <div className="px-5 pb-4 text-sm text-gray-600 leading-relaxed border-t bg-gray-50/50">
                      {item.resposta}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

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

      {/* Botão flutuante WhatsApp */}
      {config.whatsapp_flutuante_ativo && whatsappLink && (
        <a
          href={whatsappLink}
          target="_blank"
          rel="noopener"
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-[#25D366] hover:bg-[#1ebe5b] shadow-lg flex items-center justify-center transition-transform hover:scale-110"
          aria-label="Falar no WhatsApp"
        >
          <svg viewBox="0 0 24 24" className="h-7 w-7 fill-white">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.198-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
        </a>
      )}
    </div>
  );
}
