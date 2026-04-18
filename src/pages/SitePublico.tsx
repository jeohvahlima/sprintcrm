import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteRenderer } from "@/components/site-publico/SiteRenderer";
import { SiteConfig } from "@/lib/siteTemplates";

interface FullConfig extends SiteConfig {
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
  perguntas?: Array<{ campo: string; label: string; tipo?: string; obrigatorio?: boolean }>;
  tag_automatica?: string;
  sugestoes_chat?: string[];
  ativo?: boolean;
}

// Helper para inserir/atualizar tags meta
function upsertMeta(name: string, content: string, attr: 'name' | 'property' = 'name') {
  if (!content) return;
  let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertCanonical(href: string) {
  let el = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.rel = 'canonical';
    document.head.appendChild(el);
  }
  el.href = href;
}

function injectSchemaOrg(data: object) {
  const id = 'schema-org-site';
  let el = document.getElementById(id) as HTMLScriptElement | null;
  if (!el) {
    el = document.createElement('script');
    el.id = id;
    el.type = 'application/ld+json';
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
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

      // ============ SEO completo ============
      const isLanding = cfg.site_layout === 'landing_pessoal';
      const displayName = isLanding ? (cfg.especialista_nome || row.name) : row.name;
      const title = cfg.seo_title || cfg.hero_titulo || cfg.titulo || `${displayName} - Atendimento Profissional`;
      const description = cfg.seo_description || cfg.hero_subtitulo || cfg.descricao || `${displayName} - Atendimento profissional, qualidade e excelência.`;
      const ogImage = cfg.seo_og_image || cfg.especialista_foto_url || cfg.hero_imagem_url || cfg.logo_url || '';
      const url = window.location.href;

      document.title = title;
      upsertMeta('description', description);
      if (cfg.seo_keywords) upsertMeta('keywords', cfg.seo_keywords);

      // Open Graph
      upsertMeta('og:title', title, 'property');
      upsertMeta('og:description', description, 'property');
      upsertMeta('og:type', 'website', 'property');
      upsertMeta('og:url', url, 'property');
      if (ogImage) upsertMeta('og:image', ogImage, 'property');

      // Twitter Card
      upsertMeta('twitter:card', 'summary_large_image');
      upsertMeta('twitter:title', title);
      upsertMeta('twitter:description', description);
      if (ogImage) upsertMeta('twitter:image', ogImage);

      upsertCanonical(url);

      // Schema.org
      const schemaType = isLanding ? 'Person' : 'LocalBusiness';
      const schema: any = {
        '@context': 'https://schema.org',
        '@type': schemaType,
        name: displayName,
        description,
        url,
      };
      if (cfg.whatsapp) schema.telephone = cfg.whatsapp;
      if (cfg.email_contato) schema.email = cfg.email_contato;
      if (cfg.endereco) schema.address = { '@type': 'PostalAddress', streetAddress: cfg.endereco };
      if (ogImage) schema.image = ogImage;
      if (isLanding && cfg.especialista_titulo) schema.jobTitle = cfg.especialista_titulo;
      injectSchemaOrg(schema);

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
