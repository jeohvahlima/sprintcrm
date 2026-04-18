import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteConfig, getTemplateById } from "@/lib/siteTemplates";
import { AgendamentoFlow } from "@/components/site-publico/AgendamentoModal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, CalendarDays } from "lucide-react";

export default function SitePublicoAgenda() {
  const { slug } = useParams<{ slug: string }>();
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!slug) { setNotFound(true); setLoading(false); return; }
      const { data, error } = await (supabase as any).rpc('get_capture_page', { _identifier: slug });
      if (error || !data || data.length === 0) {
        setNotFound(true); setLoading(false); return;
      }
      const row = data[0];
      const cfg = (row.capture_page_config || {}) as SiteConfig;
      if (!cfg.site_published) { setNotFound(true); setLoading(false); return; }
      setConfig(cfg);
      setCompanyName(row.name);
      document.title = `Agendamento - ${row.name}`;
      setLoading(false);
    };
    load();
  }, [slug]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" /></div>;
  }
  if (notFound || !config) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div>
          <h1 className="text-2xl font-bold mb-2">Página não encontrada</h1>
          <Link to="/" className="text-primary underline">Voltar</Link>
        </div>
      </div>
    );
  }

  const template = getTemplateById(config.site_template);
  const theme = config.site_theme || template?.theme || { primary: '#0EA5E9', secondary: '#0369A1' };
  const primary = theme.primary;
  const secondary = theme.secondary;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to={`/site/${slug}`} className="flex items-center gap-2 text-sm font-medium hover:opacity-70">
            <ArrowLeft className="w-4 h-4" /> Voltar para o site
          </Link>
          <div className="font-bold">{companyName}</div>
        </div>
      </header>

      <section
        className="py-16 text-white text-center"
        style={{ background: `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)` }}
      >
        <div className="max-w-3xl mx-auto px-4">
          <CalendarDays className="w-12 h-12 mx-auto mb-4 opacity-90" />
          <h1 className="text-3xl md:text-5xl font-bold mb-3">Agende sua consulta</h1>
          <p className="text-lg opacity-90">Escolha o profissional, a data e o horário que melhor te atende</p>
        </div>
      </section>

      <main className="max-w-3xl mx-auto px-4 py-10 -mt-8">
        <Card className="p-6 md:p-8 shadow-xl">
          <AgendamentoFlow slug={slug!} companyName={companyName} primary={primary} />
        </Card>

        <div className="text-center mt-8 text-sm text-muted-foreground">
          Prefere conversar? <Link to={`/site/${slug}`} className="font-medium" style={{ color: primary }}>Volte ao site</Link> e use o chat.
        </div>
      </main>

      <footer className="py-6 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} {companyName} · Powered by Waze CRM
      </footer>
    </div>
  );
}
