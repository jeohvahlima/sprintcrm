// Templates de site institucional por segmento
// Usado em SiteInstitucionalConfig + SitePublico

export type SiteSectionKey =
  | 'hero'
  | 'sobre'
  | 'servicos'
  | 'equipe'
  | 'galeria'
  | 'depoimentos'
  | 'planos'
  | 'blog'
  | 'faq'
  | 'contato';

export interface SiteSectionConfig {
  key: SiteSectionKey;
  enabled: boolean;
  title?: string;
  subtitle?: string;
}

export interface MembroEquipe {
  nome: string;
  cargo: string;
  bio?: string;
  foto_url?: string;
}

export interface PlanoSite {
  nome: string;
  preco: string;
  periodo?: string;
  destaque?: boolean;
  descricao?: string;
  itens: string[];
  cta_texto?: string;
}

export interface PostBlog {
  titulo: string;
  resumo: string;
  conteudo?: string;
  imagem_url?: string;
  data?: string;
  autor?: string;
  slug?: string;
}

export interface SiteTheme {
  primary: string;
  secondary: string;
  accent?: string;
  font?: 'inter' | 'poppins' | 'playfair' | 'roboto';
  style?: 'modern' | 'classic' | 'bold' | 'minimal';
}

export interface SiteConfig {
  // Publicação
  site_published?: boolean;
  site_template?: string; // id do template
  site_theme?: SiteTheme;
  site_sections?: SiteSectionConfig[];

  // Conteúdo
  hero_titulo?: string;
  hero_subtitulo?: string;
  hero_cta_texto?: string;
  hero_imagem_url?: string;
  hero_video_url?: string;

  sobre_titulo?: string;
  sobre_texto?: string;
  sobre_imagem_url?: string;
  sobre_missao?: string;
  sobre_visao?: string;
  sobre_valores?: string[];

  equipe?: MembroEquipe[];
  galeria?: string[]; // URLs
  planos?: PlanoSite[];
  blog_posts?: PostBlog[];
}

const SECTIONS_DEFAULT: SiteSectionConfig[] = [
  { key: 'hero', enabled: true, title: 'Início' },
  { key: 'sobre', enabled: true, title: 'Sobre' },
  { key: 'servicos', enabled: true, title: 'Serviços' },
  { key: 'equipe', enabled: true, title: 'Equipe' },
  { key: 'galeria', enabled: false, title: 'Galeria' },
  { key: 'depoimentos', enabled: true, title: 'Depoimentos' },
  { key: 'planos', enabled: false, title: 'Planos' },
  { key: 'blog', enabled: false, title: 'Blog' },
  { key: 'faq', enabled: true, title: 'Perguntas Frequentes' },
  { key: 'contato', enabled: true, title: 'Contato' },
];

export interface SiteTemplate {
  id: string;
  nome: string;
  segmento: string;
  descricao: string;
  theme: SiteTheme;
  preview_color: string; // cor exibida no card de seleção
  config: SiteConfig;
}

export const SITE_TEMPLATES: SiteTemplate[] = [
  {
    id: 'medico-azul',
    nome: 'Clínica Médica',
    segmento: 'clinica_medica',
    descricao: 'Layout profissional para clínicas médicas, odontológicas e de estética',
    preview_color: '#0EA5E9',
    theme: { primary: '#0EA5E9', secondary: '#0369A1', accent: '#06B6D4', font: 'inter', style: 'modern' },
    config: {
      site_template: 'medico-azul',
      site_sections: SECTIONS_DEFAULT,
      hero_titulo: 'Cuidando da sua saúde com excelência',
      hero_subtitulo: 'Atendimento humanizado e tecnologia de ponta para o seu bem-estar',
      hero_cta_texto: 'Agendar consulta',
      sobre_titulo: 'Sobre a clínica',
      sobre_texto: 'Há anos cuidando da saúde de famílias com profissionais altamente qualificados e estrutura moderna.',
      sobre_missao: 'Promover saúde e qualidade de vida através de atendimento humanizado.',
      sobre_visao: 'Ser referência em cuidado médico personalizado.',
      sobre_valores: ['Ética', 'Compromisso', 'Excelência', 'Empatia'],
    },
  },
  {
    id: 'advocacia-classico',
    nome: 'Advocacia',
    segmento: 'advocacia',
    descricao: 'Visual elegante e formal para escritórios de advocacia',
    preview_color: '#1E293B',
    theme: { primary: '#1E293B', secondary: '#334155', accent: '#D4AF37', font: 'playfair', style: 'classic' },
    config: {
      site_template: 'advocacia-classico',
      site_sections: SECTIONS_DEFAULT,
      hero_titulo: 'Defendendo seus direitos com excelência',
      hero_subtitulo: 'Soluções jurídicas estratégicas e personalizadas para você e sua empresa',
      hero_cta_texto: 'Consulta jurídica',
      sobre_titulo: 'O escritório',
      sobre_texto: 'Tradição, ética e conhecimento jurídico a serviço dos nossos clientes.',
      sobre_missao: 'Defender direitos com integridade e competência.',
      sobre_valores: ['Ética', 'Sigilo', 'Excelência técnica', 'Compromisso'],
    },
  },
  {
    id: 'contabilidade-corporativo',
    nome: 'Contabilidade',
    segmento: 'contabilidade',
    descricao: 'Layout corporativo e confiável para escritórios contábeis',
    preview_color: '#059669',
    theme: { primary: '#059669', secondary: '#047857', accent: '#10B981', font: 'roboto', style: 'modern' },
    config: {
      site_template: 'contabilidade-corporativo',
      site_sections: SECTIONS_DEFAULT,
      hero_titulo: 'Contabilidade descomplicada para o seu negócio',
      hero_subtitulo: 'Soluções contábeis, fiscais e tributárias para empresas de todos os portes',
      hero_cta_texto: 'Solicitar orçamento',
      sobre_titulo: 'Quem somos',
      sobre_texto: 'Anos de experiência cuidando da saúde financeira e fiscal de empresas.',
      sobre_missao: 'Simplificar a gestão contábil das empresas.',
      sobre_valores: ['Transparência', 'Precisão', 'Pontualidade', 'Confiança'],
    },
  },
  {
    id: 'marketing-criativo',
    nome: 'Agência de Marketing',
    segmento: 'marketing_agencia',
    descricao: 'Visual moderno e vibrante para agências criativas',
    preview_color: '#8B5CF6',
    theme: { primary: '#8B5CF6', secondary: '#6D28D9', accent: '#EC4899', font: 'poppins', style: 'bold' },
    config: {
      site_template: 'marketing-criativo',
      site_sections: SECTIONS_DEFAULT,
      hero_titulo: 'Transformamos ideias em resultados',
      hero_subtitulo: 'Estratégias de marketing digital que impulsionam o crescimento do seu negócio',
      hero_cta_texto: 'Falar com especialista',
      sobre_titulo: 'A agência',
      sobre_texto: 'Criatividade, dados e estratégia para construir marcas que se destacam.',
      sobre_missao: 'Gerar resultados reais para nossos clientes.',
      sobre_valores: ['Criatividade', 'Dados', 'Inovação', 'Resultado'],
    },
  },
  {
    id: 'imobiliaria-elegante',
    nome: 'Imobiliária',
    segmento: 'imobiliaria',
    descricao: 'Layout sofisticado para imobiliárias e corretores',
    preview_color: '#EA580C',
    theme: { primary: '#EA580C', secondary: '#9A3412', accent: '#F97316', font: 'poppins', style: 'modern' },
    config: {
      site_template: 'imobiliaria-elegante',
      site_sections: SECTIONS_DEFAULT,
      hero_titulo: 'O imóvel dos seus sonhos está aqui',
      hero_subtitulo: 'Encontre o imóvel ideal com quem entende do mercado',
      hero_cta_texto: 'Ver imóveis',
      sobre_titulo: 'Sobre nós',
      sobre_texto: 'Conectamos pessoas aos seus lares e investimentos ideais.',
      sobre_missao: 'Realizar o sonho da casa própria.',
      sobre_valores: ['Confiança', 'Transparência', 'Atendimento', 'Excelência'],
    },
  },
];

export function getTemplateById(id?: string): SiteTemplate | undefined {
  return SITE_TEMPLATES.find((t) => t.id === id);
}

export function getTemplateBySegmento(segmento?: string | null): SiteTemplate | undefined {
  if (!segmento) return undefined;
  return SITE_TEMPLATES.find((t) => t.segmento === segmento);
}

export const DEFAULT_SITE_SECTIONS = SECTIONS_DEFAULT;
