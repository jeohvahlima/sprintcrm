// Templates de site institucional + Landing Pessoal por segmento
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
  | 'estatisticas'
  | 'diferenciais'
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
  registro?: string; // CRM, OAB, CRECI etc.
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

export interface EstatisticaItem {
  numero: number;
  sufixo?: string; // "+", "k", "%"
  prefixo?: string; // "R$"
  label: string;
}

export interface DiferencialItem {
  icone?: string; // nome do ícone lucide
  titulo: string;
  descricao: string;
}

export interface SiteTheme {
  primary: string;
  secondary: string;
  accent?: string;
  font?: 'inter' | 'poppins' | 'playfair' | 'roboto';
  style?: 'modern' | 'classic' | 'bold' | 'minimal' | 'premium';
  layout?: 'institucional' | 'landing_pessoal'; // tipo de site
}

export interface SiteConfig {
  // Publicação
  site_published?: boolean;
  site_template?: string;
  site_theme?: SiteTheme;
  site_sections?: SiteSectionConfig[];
  site_layout?: 'institucional' | 'landing_pessoal';

  // SEO
  seo_title?: string;
  seo_description?: string;
  seo_keywords?: string;
  seo_og_image?: string;

  // Conteúdo
  hero_titulo?: string;
  hero_subtitulo?: string;
  hero_cta_texto?: string;
  hero_cta_secundario?: string;
  hero_imagem_url?: string;
  hero_video_url?: string;
  hero_badge?: string; // ex: "+10 anos de experiência"

  sobre_titulo?: string;
  sobre_texto?: string;
  sobre_imagem_url?: string;
  sobre_missao?: string;
  sobre_visao?: string;
  sobre_valores?: string[];

  // Especialista individual (landing pessoal)
  especialista_nome?: string;
  especialista_titulo?: string; // "Cardiologista | CRM 12345"
  especialista_registro?: string; // CRM/OAB/CRECI
  especialista_foto_url?: string;
  especialista_bio?: string;
  especialista_formacao?: string[];
  especialista_especialidades?: string[];
  especialista_anos_experiencia?: number;

  // Estatísticas / contadores
  estatisticas?: EstatisticaItem[];

  // Diferenciais
  diferenciais?: DiferencialItem[];

  equipe?: MembroEquipe[];
  galeria?: string[];
  planos?: PlanoSite[];
  blog_posts?: PostBlog[];

  // Agendamento integrado
  agendamento_ativo?: boolean;
  agenda_id?: string; // referência a agendas do CRM

  // WhatsApp flutuante
  whatsapp_flutuante_ativo?: boolean;
  whatsapp_flutuante_mensagem?: string;
}

const SECTIONS_INSTITUCIONAL: SiteSectionConfig[] = [
  { key: 'hero', enabled: true, title: 'Início' },
  { key: 'estatisticas', enabled: true, title: 'Números' },
  { key: 'sobre', enabled: true, title: 'Sobre' },
  { key: 'diferenciais', enabled: true, title: 'Diferenciais' },
  { key: 'servicos', enabled: true, title: 'Serviços' },
  { key: 'equipe', enabled: true, title: 'Equipe' },
  { key: 'galeria', enabled: false, title: 'Galeria' },
  { key: 'depoimentos', enabled: true, title: 'Depoimentos' },
  { key: 'planos', enabled: false, title: 'Planos' },
  { key: 'blog', enabled: false, title: 'Blog' },
  { key: 'faq', enabled: true, title: 'FAQ' },
  { key: 'contato', enabled: true, title: 'Contato' },
];

const SECTIONS_LANDING_PESSOAL: SiteSectionConfig[] = [
  { key: 'hero', enabled: true, title: 'Início' },
  { key: 'estatisticas', enabled: true, title: 'Resultados' },
  { key: 'sobre', enabled: true, title: 'Sobre mim' },
  { key: 'diferenciais', enabled: true, title: 'Por que escolher' },
  { key: 'servicos', enabled: true, title: 'Especialidades' },
  { key: 'galeria', enabled: false, title: 'Galeria' },
  { key: 'depoimentos', enabled: true, title: 'Depoimentos' },
  { key: 'faq', enabled: true, title: 'FAQ' },
  { key: 'contato', enabled: true, title: 'Agendar' },
];

export interface SiteTemplate {
  id: string;
  nome: string;
  segmento: string;
  tipo: 'institucional' | 'landing_pessoal';
  descricao: string;
  theme: SiteTheme;
  preview_color: string;
  config: SiteConfig;
}

const STATS_DEFAULT_INSTITUCIONAL: EstatisticaItem[] = [
  { numero: 500, sufixo: '+', label: 'Clientes atendidos' },
  { numero: 10, sufixo: ' anos', label: 'De experiência' },
  { numero: 98, sufixo: '%', label: 'Satisfação' },
  { numero: 24, sufixo: '/7', label: 'Atendimento' },
];

const DIFERENCIAIS_MEDICO: DiferencialItem[] = [
  { icone: 'Stethoscope', titulo: 'Atendimento humanizado', descricao: 'Cuidado personalizado para cada paciente.' },
  { icone: 'ShieldCheck', titulo: 'Tecnologia de ponta', descricao: 'Equipamentos modernos e exames precisos.' },
  { icone: 'Clock', titulo: 'Agilidade no atendimento', descricao: 'Sem longas esperas, hora marcada respeitada.' },
  { icone: 'Award', titulo: 'Equipe qualificada', descricao: 'Profissionais experientes e atualizados.' },
];

const DIFERENCIAIS_ADV: DiferencialItem[] = [
  { icone: 'Scale', titulo: 'Ética e sigilo', descricao: 'Confidencialidade absoluta em todas as causas.' },
  { icone: 'BookOpen', titulo: 'Atualização constante', descricao: 'Conhecimento jurídico sempre em dia.' },
  { icone: 'Trophy', titulo: 'Resultados comprovados', descricao: 'Histórico de causas vencidas.' },
  { icone: 'Users', titulo: 'Atendimento próximo', descricao: 'Acompanhamento direto do seu caso.' },
];

export const SITE_TEMPLATES: SiteTemplate[] = [
  // ============ INSTITUCIONAL ============
  {
    id: 'medico-azul',
    nome: 'Clínica Médica',
    segmento: 'clinica_medica',
    tipo: 'institucional',
    descricao: 'Layout profissional para clínicas médicas, odontológicas e de estética',
    preview_color: '#0EA5E9',
    theme: { primary: '#0EA5E9', secondary: '#0369A1', accent: '#06B6D4', font: 'inter', style: 'modern', layout: 'institucional' },
    config: {
      site_template: 'medico-azul',
      site_layout: 'institucional',
      site_sections: SECTIONS_INSTITUCIONAL,
      hero_badge: '+10 anos cuidando da sua saúde',
      hero_titulo: 'Cuidando da sua saúde com excelência',
      hero_subtitulo: 'Atendimento humanizado e tecnologia de ponta para o seu bem-estar',
      hero_cta_texto: 'Agendar consulta',
      hero_cta_secundario: 'Conhecer especialidades',
      sobre_titulo: 'Sobre a clínica',
      sobre_texto: 'Há anos cuidando da saúde de famílias com profissionais altamente qualificados e estrutura moderna.',
      sobre_missao: 'Promover saúde e qualidade de vida através de atendimento humanizado.',
      sobre_visao: 'Ser referência em cuidado médico personalizado.',
      sobre_valores: ['Ética', 'Compromisso', 'Excelência', 'Empatia'],
      estatisticas: STATS_DEFAULT_INSTITUCIONAL,
      diferenciais: DIFERENCIAIS_MEDICO,
      whatsapp_flutuante_ativo: true,
      whatsapp_flutuante_mensagem: 'Olá! Gostaria de agendar uma consulta.',
    },
  },
  {
    id: 'advocacia-classico',
    nome: 'Advocacia Premium',
    segmento: 'advocacia',
    tipo: 'institucional',
    descricao: 'Visual elegante e formal para escritórios de advocacia',
    preview_color: '#1E293B',
    theme: { primary: '#1E293B', secondary: '#334155', accent: '#D4AF37', font: 'playfair', style: 'classic', layout: 'institucional' },
    config: {
      site_template: 'advocacia-classico',
      site_layout: 'institucional',
      site_sections: SECTIONS_INSTITUCIONAL,
      hero_badge: 'Tradição e resultados',
      hero_titulo: 'Defendendo seus direitos com excelência',
      hero_subtitulo: 'Soluções jurídicas estratégicas e personalizadas para você e sua empresa',
      hero_cta_texto: 'Consulta jurídica',
      sobre_titulo: 'O escritório',
      sobre_texto: 'Tradição, ética e conhecimento jurídico a serviço dos nossos clientes.',
      sobre_missao: 'Defender direitos com integridade e competência.',
      sobre_valores: ['Ética', 'Sigilo', 'Excelência técnica', 'Compromisso'],
      estatisticas: [
        { numero: 1500, sufixo: '+', label: 'Causas vencidas' },
        { numero: 20, sufixo: ' anos', label: 'De atuação' },
        { numero: 95, sufixo: '%', label: 'Taxa de sucesso' },
        { numero: 800, sufixo: '+', label: 'Clientes' },
      ],
      diferenciais: DIFERENCIAIS_ADV,
      whatsapp_flutuante_ativo: true,
      whatsapp_flutuante_mensagem: 'Olá! Preciso de orientação jurídica.',
    },
  },
  {
    id: 'contabilidade-corporativo',
    nome: 'Contabilidade',
    segmento: 'contabilidade',
    tipo: 'institucional',
    descricao: 'Layout corporativo e confiável para escritórios contábeis',
    preview_color: '#059669',
    theme: { primary: '#059669', secondary: '#047857', accent: '#10B981', font: 'roboto', style: 'modern', layout: 'institucional' },
    config: {
      site_template: 'contabilidade-corporativo',
      site_layout: 'institucional',
      site_sections: SECTIONS_INSTITUCIONAL,
      hero_badge: 'Soluções contábeis completas',
      hero_titulo: 'Contabilidade descomplicada para o seu negócio',
      hero_subtitulo: 'Soluções contábeis, fiscais e tributárias para empresas de todos os portes',
      hero_cta_texto: 'Solicitar orçamento',
      sobre_titulo: 'Quem somos',
      sobre_texto: 'Anos de experiência cuidando da saúde financeira e fiscal de empresas.',
      sobre_missao: 'Simplificar a gestão contábil das empresas.',
      sobre_valores: ['Transparência', 'Precisão', 'Pontualidade', 'Confiança'],
      estatisticas: STATS_DEFAULT_INSTITUCIONAL,
      whatsapp_flutuante_ativo: true,
    },
  },
  {
    id: 'marketing-criativo',
    nome: 'Agência de Marketing',
    segmento: 'marketing_agencia',
    tipo: 'institucional',
    descricao: 'Visual moderno e vibrante para agências criativas',
    preview_color: '#8B5CF6',
    theme: { primary: '#8B5CF6', secondary: '#6D28D9', accent: '#EC4899', font: 'poppins', style: 'bold', layout: 'institucional' },
    config: {
      site_template: 'marketing-criativo',
      site_layout: 'institucional',
      site_sections: SECTIONS_INSTITUCIONAL,
      hero_badge: '🚀 Resultados reais',
      hero_titulo: 'Transformamos ideias em resultados',
      hero_subtitulo: 'Estratégias de marketing digital que impulsionam o crescimento do seu negócio',
      hero_cta_texto: 'Falar com especialista',
      sobre_titulo: 'A agência',
      sobre_texto: 'Criatividade, dados e estratégia para construir marcas que se destacam.',
      sobre_missao: 'Gerar resultados reais para nossos clientes.',
      sobre_valores: ['Criatividade', 'Dados', 'Inovação', 'Resultado'],
      estatisticas: [
        { numero: 200, sufixo: '+', label: 'Clientes ativos' },
        { numero: 5, prefixo: 'R$', sufixo: 'M+', label: 'Em vendas geradas' },
        { numero: 50, sufixo: '+', label: 'Especialistas' },
        { numero: 8, sufixo: ' anos', label: 'No mercado' },
      ],
      whatsapp_flutuante_ativo: true,
    },
  },
  {
    id: 'imobiliaria-elegante',
    nome: 'Imobiliária',
    segmento: 'imobiliaria',
    tipo: 'institucional',
    descricao: 'Layout sofisticado para imobiliárias',
    preview_color: '#EA580C',
    theme: { primary: '#EA580C', secondary: '#9A3412', accent: '#F97316', font: 'poppins', style: 'modern', layout: 'institucional' },
    config: {
      site_template: 'imobiliaria-elegante',
      site_layout: 'institucional',
      site_sections: SECTIONS_INSTITUCIONAL,
      hero_badge: 'O imóvel ideal está aqui',
      hero_titulo: 'O imóvel dos seus sonhos está aqui',
      hero_subtitulo: 'Encontre o imóvel ideal com quem entende do mercado',
      hero_cta_texto: 'Ver imóveis',
      sobre_titulo: 'Sobre nós',
      sobre_texto: 'Conectamos pessoas aos seus lares e investimentos ideais.',
      sobre_missao: 'Realizar o sonho da casa própria.',
      sobre_valores: ['Confiança', 'Transparência', 'Atendimento', 'Excelência'],
      estatisticas: STATS_DEFAULT_INSTITUCIONAL,
      whatsapp_flutuante_ativo: true,
    },
  },

  // ============ LANDING PESSOAL (especialista individual) ============
  {
    id: 'landing-medico',
    nome: 'Médico Especialista',
    segmento: 'clinica_medica',
    tipo: 'landing_pessoal',
    descricao: 'Landing page premium para médico autônomo / especialista individual',
    preview_color: '#0284C7',
    theme: { primary: '#0284C7', secondary: '#0C4A6E', accent: '#38BDF8', font: 'inter', style: 'premium', layout: 'landing_pessoal' },
    config: {
      site_template: 'landing-medico',
      site_layout: 'landing_pessoal',
      site_sections: SECTIONS_LANDING_PESSOAL,
      hero_badge: 'Atendimento especializado',
      hero_titulo: 'Cuidado médico que transforma vidas',
      hero_subtitulo: 'Atendimento humanizado, diagnósticos precisos e tratamentos personalizados.',
      hero_cta_texto: 'Agendar consulta',
      hero_cta_secundario: 'Conhecer mais',
      especialista_nome: 'Dr. Nome Sobrenome',
      especialista_titulo: 'Cardiologista',
      especialista_registro: 'CRM 00000',
      especialista_anos_experiencia: 15,
      especialista_bio: 'Médico especialista com formação nas melhores instituições do país, dedicado ao cuidado integral do paciente.',
      especialista_formacao: ['Graduação em Medicina - USP', 'Residência em Cardiologia - InCor', 'Pós-graduação - Harvard Medical School'],
      especialista_especialidades: ['Cardiologia clínica', 'Ecocardiograma', 'Check-up cardiovascular', 'Acompanhamento contínuo'],
      estatisticas: [
        { numero: 5000, sufixo: '+', label: 'Pacientes atendidos' },
        { numero: 15, sufixo: ' anos', label: 'De experiência' },
        { numero: 98, sufixo: '%', label: 'Satisfação' },
      ],
      diferenciais: DIFERENCIAIS_MEDICO,
      agendamento_ativo: true,
      whatsapp_flutuante_ativo: true,
      whatsapp_flutuante_mensagem: 'Olá Dr.! Gostaria de agendar uma consulta.',
    },
  },
  {
    id: 'landing-advogado',
    nome: 'Advogado Especialista',
    segmento: 'advocacia',
    tipo: 'landing_pessoal',
    descricao: 'Landing page elegante para advogado individual',
    preview_color: '#0F172A',
    theme: { primary: '#0F172A', secondary: '#1E293B', accent: '#CA8A04', font: 'playfair', style: 'premium', layout: 'landing_pessoal' },
    config: {
      site_template: 'landing-advogado',
      site_layout: 'landing_pessoal',
      site_sections: SECTIONS_LANDING_PESSOAL,
      hero_badge: 'Defesa jurídica especializada',
      hero_titulo: 'Seus direitos defendidos com excelência',
      hero_subtitulo: 'Atuação estratégica e personalizada para causas cíveis, trabalhistas e empresariais.',
      hero_cta_texto: 'Consultoria jurídica',
      especialista_nome: 'Dr. Nome Sobrenome',
      especialista_titulo: 'Advogado Especialista',
      especialista_registro: 'OAB/SP 000000',
      especialista_anos_experiencia: 12,
      especialista_bio: 'Advogado com sólida experiência em direito civil, trabalhista e empresarial. Atendimento personalizado e estratégico.',
      especialista_formacao: ['Graduação em Direito - PUC', 'Especialização em Direito Empresarial', 'Mestrado em Direito Civil'],
      especialista_especialidades: ['Direito Civil', 'Direito Trabalhista', 'Direito Empresarial', 'Contratos'],
      estatisticas: [
        { numero: 1200, sufixo: '+', label: 'Causas atendidas' },
        { numero: 12, sufixo: ' anos', label: 'De atuação' },
        { numero: 92, sufixo: '%', label: 'Taxa de sucesso' },
      ],
      diferenciais: DIFERENCIAIS_ADV,
      agendamento_ativo: true,
      whatsapp_flutuante_ativo: true,
      whatsapp_flutuante_mensagem: 'Olá! Preciso de uma consultoria jurídica.',
    },
  },
  {
    id: 'landing-corretor',
    nome: 'Corretor de Imóveis',
    segmento: 'imobiliaria',
    tipo: 'landing_pessoal',
    descricao: 'Landing page para corretor autônomo',
    preview_color: '#DC2626',
    theme: { primary: '#DC2626', secondary: '#991B1B', accent: '#F87171', font: 'poppins', style: 'modern', layout: 'landing_pessoal' },
    config: {
      site_template: 'landing-corretor',
      site_layout: 'landing_pessoal',
      site_sections: SECTIONS_LANDING_PESSOAL,
      hero_badge: 'Realize o sonho da casa própria',
      hero_titulo: 'O imóvel ideal para você',
      hero_subtitulo: 'Atendimento personalizado para encontrar o imóvel perfeito para sua família ou investimento.',
      hero_cta_texto: 'Falar comigo',
      especialista_nome: 'Nome Sobrenome',
      especialista_titulo: 'Corretor de Imóveis',
      especialista_registro: 'CRECI 00000',
      especialista_anos_experiencia: 8,
      especialista_bio: 'Corretor especializado em imóveis residenciais e comerciais, com profundo conhecimento do mercado local.',
      especialista_especialidades: ['Imóveis residenciais', 'Imóveis comerciais', 'Lançamentos', 'Investimento imobiliário'],
      estatisticas: [
        { numero: 350, sufixo: '+', label: 'Imóveis vendidos' },
        { numero: 8, sufixo: ' anos', label: 'De mercado' },
        { numero: 100, sufixo: '%', label: 'Compromisso' },
      ],
      whatsapp_flutuante_ativo: true,
    },
  },
];

export function getTemplateById(id?: string): SiteTemplate | undefined {
  return SITE_TEMPLATES.find((t) => t.id === id);
}

export function getTemplateBySegmento(segmento?: string | null): SiteTemplate | undefined {
  if (!segmento) return undefined;
  return SITE_TEMPLATES.find((t) => t.segmento === segmento && t.tipo === 'institucional');
}

export function getTemplatesByTipo(tipo: 'institucional' | 'landing_pessoal'): SiteTemplate[] {
  return SITE_TEMPLATES.filter((t) => t.tipo === tipo);
}

export const DEFAULT_SITE_SECTIONS = SECTIONS_INSTITUCIONAL;
export const DEFAULT_LANDING_SECTIONS = SECTIONS_LANDING_PESSOAL;
