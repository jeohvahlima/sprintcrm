import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteRenderer } from "@/components/site-publico/SiteRenderer";
import { SiteConfig } from "@/lib/siteTemplates";

interface FullConfig extends SiteConfig {
  // capture page fields também
  titulo?: string;
  descricao?: string;
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
  ativo?: boolean;
}

export default function SitePublico() {
  const { slug } = useParams<{ slug: string }>();
  const [config, setConfig] = useState<FullConfig | null>(null);
  const [companyId, setCompanyId] = useState<string>('');
  const [companyName, setCompanyName] = useState<string>('');
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
      const cfg = (row.capture_page_config || {}) as FullConfig;
      if (!cfg.site_published) {
        setNotFound(true); setLoading(false); return;
      }
      setConfig(cfg);
      setCompanyId(row.id);
      setCompanyName(row.name);

      // SEO
      document.title = cfg.hero_titulo || cfg.titulo || row.name;
      setLoading(false);
    };
    load();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  if (notFound || !config) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center space-y-3">
          <h1 className="text-3xl font-bold">Site não encontrado</h1>
          <p className="text-muted-foreground">Esta página não está disponível ou ainda não foi publicada.</p>
        </div>
      </div>
    );
  }

  return (
    <SiteRenderer
      config={config as any}
      companyId={companyId}
      companyName={companyName}
      slug={slug || ''}
    />
  );
}
