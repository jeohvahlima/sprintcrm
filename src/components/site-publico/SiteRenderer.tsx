import { useState } from "react";
import { SiteConfig, getTemplateById, DEFAULT_SITE_SECTIONS } from "@/lib/siteTemplates";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Phone, Mail, MapPin, MessageCircle, Star, ChevronDown, Check } from "lucide-react";
import { ChatCaptureWidget } from "./ChatCaptureWidget";

interface FullConfig extends SiteConfig {
  titulo?: string;
  cor_primaria?: string;
  cor_secundaria?: string;
  logo_url?: string;
  whatsapp?: string;
  telefone_contato?: string;
  email_contato?: string;
  endereco?: string;
  servicos?: Array<{ nome: string; descricao?: string; imagem_url?: string }>;
  depoimentos?: Array<{ nome: string; texto: string; estrelas?: number; foto_url?: string }>;
  faq?: Array<{ pergunta: string; resposta: string }>;
  whatsapp_flutuante_ativo?: boolean;
  whatsapp_flutuante_mensagem?: string;
  perguntas?: Array<{ campo: string; label: string; tipo?: string; obrigatorio?: boolean }>;
  tag_automatica?: string;
  sugestoes_chat?: string[];
}

interface Props {
  config: FullConfig;
  companyId: string;
  companyName: string;
  slug: string;
  previewMode?: boolean;
}

export function SiteRenderer({ config, companyId, companyName, slug, previewMode }: Props) {
  const template = getTemplateById(config.site_template);
  const theme = config.site_theme || template?.theme || { primary: config.cor_primaria || '#8B5CF6', secondary: config.cor_secundaria || '#6D28D9' };
  const sections = config.site_sections?.length ? config.site_sections : DEFAULT_SITE_SECTIONS;
  const enabled = (key: string) => sections.find((s) => s.key === key)?.enabled !== false;

  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [chatOpen, setChatOpen] = useState(false);

  const primary = theme.primary;
  const secondary = theme.secondary;
  const accent = theme.accent || theme.primary;

  const fontClass =
    theme.font === 'playfair' ? 'font-serif' :
    theme.font === 'poppins' ? 'font-sans' :
    theme.font === 'roboto' ? 'font-sans' : 'font-sans';

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const navItems = sections.filter((s) => s.enabled && s.key !== 'hero');

  return (
    <div className={`min-h-screen bg-white text-slate-900 ${fontClass}`}>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {config.logo_url ? (
              <img src={config.logo_url} alt={companyName} className="h-10 w-auto" />
            ) : (
              <div className="h-10 w-10 rounded-lg flex items-center justify-center text-white font-bold" style={{ background: primary }}>
                {companyName.charAt(0)}
              </div>
            )}
            <span className="font-bold text-lg">{companyName}</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            {navItems.map((s) => (
              <button key={s.key} onClick={() => scrollTo(s.key)} className="hover:opacity-70 transition">
                {s.title}
              </button>
            ))}
          </nav>
          {config.whatsapp && (
            <Button asChild size="sm" style={{ background: primary }}>
              <a href={`https://wa.me/${config.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">
                <MessageCircle className="w-4 h-4 mr-1" /> Falar agora
              </a>
            </Button>
          )}
        </div>
      </header>

      {/* HERO */}
      {enabled('hero') && (
        <section id="hero" className="relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)` }}>
          <div className="max-w-7xl mx-auto px-4 py-20 md:py-32 grid md:grid-cols-2 gap-10 items-center text-white">
            <div className="space-y-6">
              <h1 className="text-4xl md:text-6xl font-bold leading-tight">
                {config.hero_titulo || `Bem-vindo à ${companyName}`}
              </h1>
              <p className="text-lg md:text-xl opacity-90">
                {config.hero_subtitulo || 'Soluções profissionais para o seu negócio'}
              </p>
              <div className="flex gap-3 flex-wrap">
                <Button size="lg" onClick={() => setChatOpen(true)} className="bg-white text-slate-900 hover:bg-slate-100">
                  {config.hero_cta_texto || 'Fale conosco'}
                </Button>
                {enabled('servicos') && (
                  <Button size="lg" variant="outline" onClick={() => scrollTo('servicos')} className="border-white text-white hover:bg-white/10">
                    Ver serviços
                  </Button>
                )}
              </div>
            </div>
            {config.hero_imagem_url && (
              <div>
                <img src={config.hero_imagem_url} alt="Hero" className="rounded-2xl shadow-2xl w-full" />
              </div>
            )}
          </div>
        </section>
      )}

      {/* SOBRE */}
      {enabled('sobre') && (
        <section id="sobre" className="py-16 md:py-24">
          <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-2 gap-10 items-center">
            {config.sobre_imagem_url && (
              <img src={config.sobre_imagem_url} alt="Sobre" className="rounded-2xl shadow-lg" />
            )}
            <div className={config.sobre_imagem_url ? '' : 'md:col-span-2 max-w-3xl mx-auto text-center'}>
              <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: primary }}>
                {config.sobre_titulo || 'Sobre nós'}
              </h2>
              <p className="text-slate-600 text-lg mb-6">{config.sobre_texto}</p>
              {(config.sobre_missao || config.sobre_visao) && (
                <div className="grid sm:grid-cols-2 gap-4 mb-6">
                  {config.sobre_missao && (
                    <Card className="p-5">
                      <h3 className="font-bold mb-2" style={{ color: primary }}>Missão</h3>
                      <p className="text-sm text-slate-600">{config.sobre_missao}</p>
                    </Card>
                  )}
                  {config.sobre_visao && (
                    <Card className="p-5">
                      <h3 className="font-bold mb-2" style={{ color: primary }}>Visão</h3>
                      <p className="text-sm text-slate-600">{config.sobre_visao}</p>
                    </Card>
                  )}
                </div>
              )}
              {config.sobre_valores && config.sobre_valores.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {config.sobre_valores.map((v, i) => (
                    <span key={i} className="px-4 py-2 rounded-full text-sm font-medium text-white" style={{ background: accent }}>{v}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* SERVIÇOS */}
      {enabled('servicos') && config.servicos && config.servicos.length > 0 && (
        <section id="servicos" className="py-16 md:py-24 bg-slate-50">
          <div className="max-w-7xl mx-auto px-4">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12" style={{ color: primary }}>Nossos Serviços</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {config.servicos.map((s, i) => (
                <Card key={i} className="p-6 hover:shadow-xl transition-shadow">
                  {s.imagem_url && <img src={s.imagem_url} alt={s.nome} className="w-full h-40 object-cover rounded-lg mb-4" />}
                  <h3 className="font-bold text-xl mb-2" style={{ color: primary }}>{s.nome}</h3>
                  <p className="text-slate-600 text-sm">{s.descricao}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* EQUIPE */}
      {enabled('equipe') && config.equipe && config.equipe.length > 0 && (
        <section id="equipe" className="py-16 md:py-24">
          <div className="max-w-7xl mx-auto px-4">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12" style={{ color: primary }}>Nossa Equipe</h2>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {config.equipe.map((m, i) => (
                <Card key={i} className="p-6 text-center">
                  {m.foto_url ? (
                    <img src={m.foto_url} alt={m.nome} className="w-24 h-24 mx-auto rounded-full object-cover mb-4" />
                  ) : (
                    <div className="w-24 h-24 mx-auto rounded-full mb-4 flex items-center justify-center text-white text-2xl font-bold" style={{ background: primary }}>
                      {m.nome.charAt(0)}
                    </div>
                  )}
                  <h3 className="font-bold">{m.nome}</h3>
                  <p className="text-sm" style={{ color: primary }}>{m.cargo}</p>
                  {m.bio && <p className="text-xs text-slate-500 mt-2">{m.bio}</p>}
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* GALERIA */}
      {enabled('galeria') && config.galeria && config.galeria.length > 0 && (
        <section id="galeria" className="py-16 md:py-24 bg-slate-50">
          <div className="max-w-7xl mx-auto px-4">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12" style={{ color: primary }}>Galeria</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {config.galeria.map((img, i) => (
                <img key={i} src={img} alt={`Galeria ${i + 1}`} className="w-full aspect-square object-cover rounded-lg hover:scale-105 transition" />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* DEPOIMENTOS */}
      {enabled('depoimentos') && config.depoimentos && config.depoimentos.length > 0 && (
        <section id="depoimentos" className="py-16 md:py-24">
          <div className="max-w-7xl mx-auto px-4">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12" style={{ color: primary }}>O que nossos clientes dizem</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {config.depoimentos.map((d, i) => (
                <Card key={i} className="p-6">
                  <div className="flex gap-1 mb-3">
                    {Array.from({ length: d.estrelas || 5 }).map((_, idx) => (
                      <Star key={idx} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-slate-600 italic mb-4">"{d.texto}"</p>
                  <div className="flex items-center gap-3">
                    {d.foto_url ? (
                      <img src={d.foto_url} alt={d.nome} className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ background: primary }}>
                        {d.nome.charAt(0)}
                      </div>
                    )}
                    <span className="font-medium">{d.nome}</span>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* PLANOS */}
      {enabled('planos') && config.planos && config.planos.length > 0 && (
        <section id="planos" className="py-16 md:py-24 bg-slate-50">
          <div className="max-w-7xl mx-auto px-4">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12" style={{ color: primary }}>Planos & Preços</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {config.planos.map((p, i) => (
                <Card key={i} className={`p-8 ${p.destaque ? 'ring-2 scale-105' : ''}`} style={p.destaque ? { borderColor: primary } : {}}>
                  {p.destaque && (
                    <div className="text-xs font-bold text-white px-3 py-1 rounded-full inline-block mb-3" style={{ background: primary }}>MAIS POPULAR</div>
                  )}
                  <h3 className="font-bold text-xl mb-1">{p.nome}</h3>
                  {p.descricao && <p className="text-sm text-slate-500 mb-4">{p.descricao}</p>}
                  <div className="mb-6">
                    <span className="text-4xl font-bold" style={{ color: primary }}>{p.preco}</span>
                    {p.periodo && <span className="text-slate-500">/{p.periodo}</span>}
                  </div>
                  <ul className="space-y-2 mb-6">
                    {p.itens.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: primary }} />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <Button className="w-full" style={{ background: primary }} onClick={() => setChatOpen(true)}>
                    {p.cta_texto || 'Contratar'}
                  </Button>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* BLOG */}
      {enabled('blog') && config.blog_posts && config.blog_posts.length > 0 && (
        <section id="blog" className="py-16 md:py-24">
          <div className="max-w-7xl mx-auto px-4">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12" style={{ color: primary }}>Blog & Notícias</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {config.blog_posts.map((post, i) => (
                <Card key={i} className="overflow-hidden hover:shadow-xl transition">
                  {post.imagem_url && <img src={post.imagem_url} alt={post.titulo} className="w-full h-48 object-cover" />}
                  <div className="p-5">
                    <h3 className="font-bold mb-2 line-clamp-2">{post.titulo}</h3>
                    <p className="text-sm text-slate-600 mb-3 line-clamp-3">{post.resumo}</p>
                    <div className="text-xs text-slate-400">{post.autor} · {post.data}</div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      {enabled('faq') && config.faq && config.faq.length > 0 && (
        <section id="faq" className="py-16 md:py-24 bg-slate-50">
          <div className="max-w-3xl mx-auto px-4">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12" style={{ color: primary }}>Perguntas Frequentes</h2>
            <div className="space-y-3">
              {config.faq.map((f, i) => (
                <Card key={i} className="overflow-hidden">
                  <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full p-5 flex items-center justify-between text-left hover:bg-slate-50">
                    <span className="font-medium">{f.pergunta}</span>
                    <ChevronDown className={`w-5 h-5 transition ${openFaq === i ? 'rotate-180' : ''}`} />
                  </button>
                  {openFaq === i && <div className="px-5 pb-5 text-slate-600 text-sm">{f.resposta}</div>}
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CONTATO */}
      {enabled('contato') && (
        <section id="contato" className="py-16 md:py-24" style={{ background: primary, color: 'white' }}>
          <div className="max-w-5xl mx-auto px-4 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Entre em contato</h2>
            <p className="text-lg opacity-90 mb-10">Estamos prontos para atender você</p>
            <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-6 text-left">
              {config.whatsapp && (
                <a href={`https://wa.me/${config.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="flex flex-col items-center gap-2 hover:opacity-80">
                  <MessageCircle className="w-8 h-8" />
                  <span className="text-sm font-medium">WhatsApp</span>
                  <span className="text-xs opacity-80">{config.whatsapp}</span>
                </a>
              )}
              {config.telefone_contato && (
                <a href={`tel:${config.telefone_contato}`} className="flex flex-col items-center gap-2 hover:opacity-80">
                  <Phone className="w-8 h-8" />
                  <span className="text-sm font-medium">Telefone</span>
                  <span className="text-xs opacity-80">{config.telefone_contato}</span>
                </a>
              )}
              {config.email_contato && (
                <a href={`mailto:${config.email_contato}`} className="flex flex-col items-center gap-2 hover:opacity-80">
                  <Mail className="w-8 h-8" />
                  <span className="text-sm font-medium">E-mail</span>
                  <span className="text-xs opacity-80">{config.email_contato}</span>
                </a>
              )}
              {config.endereco && (
                <div className="flex flex-col items-center gap-2">
                  <MapPin className="w-8 h-8" />
                  <span className="text-sm font-medium">Endereço</span>
                  <span className="text-xs opacity-80 text-center">{config.endereco}</span>
                </div>
              )}
            </div>
            <Button size="lg" className="mt-10 bg-white text-slate-900 hover:bg-slate-100" onClick={() => setChatOpen(true)}>
              Iniciar conversa
            </Button>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="py-8 bg-slate-900 text-slate-400 text-center text-sm">
        <div>© {new Date().getFullYear()} {companyName}. Todos os direitos reservados.</div>
        {previewMode && <div className="text-xs mt-2 opacity-70">[Modo Preview]</div>}
      </footer>

      {/* Chat widget flutuante */}
      {!previewMode && (
        <ChatCaptureWidget
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          companyId={companyId}
          companyName={companyName}
          config={config as any}
          theme={theme}
        />
      )}
    </div>
  );
}
