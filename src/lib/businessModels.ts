// Modelos de negócio para o Revenue Mix Engine.
// Cada modelo adapta a jornada/esteira de venda, terminologia, métricas
// e templates de portfólio para diferentes tipos de empresa.

export type BusinessModelId =
  | "b2b_consultivo"        // Vendas consultivas com SDR + Closer (consultoria, SaaS, financeiro, jurídico, agências)
  | "servico_recorrente"    // Clínicas, academias, serviços com retorno frequente
  | "varejo_balcao"         // Loja física, atendimento de balcão, ticket variável
  | "ecommerce"             // Loja online, múltiplas transações, sem reunião
  | "alimentacao"           // Restaurante, delivery, pedidos diários
  | "produto_alto_ticket"   // Imobiliária, automotivo, móveis sob medida
  | "educacao"              // Cursos, escolas, matrículas com ciclo definido
  | "personalizado";        // Modo livre, sem preset

export interface BusinessModelDef {
  id: BusinessModelId;
  label: string;
  emoji: string;
  description: string;
  // Esteira/jornada
  hasSDR: boolean;            // Existe etapa de prospecção/qualificação?
  hasMeeting: boolean;        // Existe etapa de reunião agendada?
  // Terminologia
  terms: {
    venda: string;            // "venda", "matrícula", "pedido", "atendimento", "contrato"
    vendaPlural: string;
    lead: string;             // "lead", "interessado", "visitante", "cliente potencial"
    leadPlural: string;
    closer: string;           // "vendedor", "consultor", "atendente", "corretor"
    sdr: string;              // "SDR", "captador", "panfleteiro digital"
    reuniao: string;          // "reunião", "visita", "atendimento", "demonstração"
    reuniaoPlural: string;
    ticket: string;           // "ticket médio", "valor médio do pedido"
    ciclo: string;            // "ciclo de vendas", "tempo de decisão"
  };
  // Defaults para o portfólio
  defaults: {
    ticket: number;
    margin_pct: number;
    win_rate: number;            // % de fechamento (reunião → venda) OU (atendimento → venda)
    meeting_show_rate: number;   // % comparecimento (se hasMeeting=false, vira "% conversão visita→pedido")
    lead_to_meeting_rate: number;// % lead → reunião (se hasMeeting=false, vira "% lead → cliente atendido")
    cac: number;
    sdr_capacity_per_day: number;   // Leads/dia por SDR (ou clientes/dia em varejo)
    closer_capacity_per_day: number;// Reuniões/dia OU vendas/dia
    cycle_days: number;
  };
  // Templates de ofertas pré-cadastradas
  offerTemplates: Array<{ name: string; ticket: number; margin_pct: number; target_sales: number }>;
  // Hints específicos
  hints: {
    ticket: string;
    win_rate: string;
    closer_capacity: string;
  };
}

export const BUSINESS_MODELS: BusinessModelDef[] = [
  {
    id: "b2b_consultivo",
    label: "B2B Consultivo (SDR + Closer)",
    emoji: "🤝",
    description: "Vendas com prospecção ativa, qualificação e reunião. Ex: consultoria, SaaS, financeiro, jurídico, agências.",
    hasSDR: true,
    hasMeeting: true,
    terms: {
      venda: "venda", vendaPlural: "vendas",
      lead: "lead", leadPlural: "leads",
      closer: "Closer/Vendedor", sdr: "SDR",
      reuniao: "reunião", reuniaoPlural: "reuniões",
      ticket: "ticket médio", ciclo: "ciclo de vendas",
    },
    defaults: {
      ticket: 5000, margin_pct: 60, win_rate: 25, meeting_show_rate: 70,
      lead_to_meeting_rate: 15, cac: 800,
      sdr_capacity_per_day: 30, closer_capacity_per_day: 4, cycle_days: 22,
    },
    offerTemplates: [
      { name: "Consultoria Mensal", ticket: 5000, margin_pct: 65, target_sales: 8 },
      { name: "Setup / Implantação", ticket: 12000, margin_pct: 50, target_sales: 3 },
    ],
    hints: {
      ticket: "Valor médio cobrado por contrato/projeto.",
      win_rate: "Das reuniões realizadas, quantas viram contrato fechado.",
      closer_capacity: "Quantas reuniões cada vendedor consegue fazer/dia (média 3–5).",
    },
  },
  {
    id: "servico_recorrente",
    label: "Serviço com Retorno (Clínicas, Academias)",
    emoji: "🩺",
    description: "Atendimento agendado com retorno frequente. Ex: clínica médica, estética, odontológica, academia, salão.",
    hasSDR: true,
    hasMeeting: true,
    terms: {
      venda: "procedimento", vendaPlural: "procedimentos",
      lead: "interessado", leadPlural: "interessados",
      closer: "Atendente/Especialista", sdr: "Recepcionista/SDR",
      reuniao: "consulta/avaliação", reuniaoPlural: "consultas",
      ticket: "ticket médio por atendimento", ciclo: "ciclo de decisão",
    },
    defaults: {
      ticket: 800, margin_pct: 70, win_rate: 45, meeting_show_rate: 75,
      lead_to_meeting_rate: 35, cac: 120,
      sdr_capacity_per_day: 40, closer_capacity_per_day: 8, cycle_days: 26,
    },
    offerTemplates: [
      { name: "Consulta / Avaliação", ticket: 200, margin_pct: 80, target_sales: 80 },
      { name: "Procedimento principal", ticket: 1500, margin_pct: 65, target_sales: 30 },
      { name: "Pacote / Plano de tratamento", ticket: 4500, margin_pct: 60, target_sales: 10 },
    ],
    hints: {
      ticket: "Quanto o paciente/cliente gasta em média por atendimento.",
      win_rate: "Dos que compareceram, quantos fecharam o procedimento/pacote.",
      closer_capacity: "Quantos atendimentos cada profissional faz/dia (média 6–10).",
    },
  },
  {
    id: "varejo_balcao",
    label: "Varejo / Loja Física",
    emoji: "🛍️",
    description: "Atendimento de balcão, ticket variável, sem reunião agendada. Ex: loja, óticas, calçados, vestuário.",
    hasSDR: false,
    hasMeeting: false,
    terms: {
      venda: "venda", vendaPlural: "vendas",
      lead: "visitante da loja", leadPlural: "visitantes",
      closer: "Vendedor de loja", sdr: "—",
      reuniao: "atendimento", reuniaoPlural: "atendimentos",
      ticket: "ticket médio por pedido", ciclo: "período",
    },
    defaults: {
      ticket: 280, margin_pct: 45, win_rate: 35, meeting_show_rate: 100,
      lead_to_meeting_rate: 80, cac: 25,
      sdr_capacity_per_day: 0, closer_capacity_per_day: 25, cycle_days: 26,
    },
    offerTemplates: [
      { name: "Categoria principal", ticket: 250, margin_pct: 45, target_sales: 300 },
      { name: "Categoria premium", ticket: 800, margin_pct: 50, target_sales: 50 },
      { name: "Acessórios / Add-on", ticket: 80, margin_pct: 60, target_sales: 200 },
    ],
    hints: {
      ticket: "Valor médio gasto por cliente em uma compra (faturamento ÷ nº de pedidos).",
      win_rate: "Dos que entraram na loja, quantos compraram (taxa de conversão).",
      closer_capacity: "Quantos clientes cada vendedor atende/dia (média 20–40).",
    },
  },
  {
    id: "ecommerce",
    label: "E-commerce / Loja Online",
    emoji: "🛒",
    description: "Vendas digitais sem atendimento humano direto. Ex: lojas Shopify, Mercado Livre, marketplace.",
    hasSDR: false,
    hasMeeting: false,
    terms: {
      venda: "pedido", vendaPlural: "pedidos",
      lead: "visita ao site", leadPlural: "visitas",
      closer: "Time de marketing", sdr: "—",
      reuniao: "carrinho", reuniaoPlural: "carrinhos",
      ticket: "ticket médio do pedido", ciclo: "período",
    },
    defaults: {
      ticket: 180, margin_pct: 40, win_rate: 65, meeting_show_rate: 100,
      lead_to_meeting_rate: 4, cac: 35,
      sdr_capacity_per_day: 0, closer_capacity_per_day: 999, cycle_days: 30,
    },
    offerTemplates: [
      { name: "Top sellers", ticket: 150, margin_pct: 40, target_sales: 500 },
      { name: "Linha premium", ticket: 600, margin_pct: 50, target_sales: 80 },
    ],
    hints: {
      ticket: "Valor médio do pedido (AOV — Average Order Value).",
      win_rate: "Dos carrinhos criados, quantos viraram pedido pago (anti-cart-abandonment).",
      closer_capacity: "E-commerce escala sem limite humano; deixe alto.",
    },
  },
  {
    id: "alimentacao",
    label: "Alimentação / Restaurante / Delivery",
    emoji: "🍔",
    description: "Alto volume diário, ticket baixo, ciclo curto. Ex: restaurante, lanchonete, dark kitchen.",
    hasSDR: false,
    hasMeeting: false,
    terms: {
      venda: "pedido", vendaPlural: "pedidos",
      lead: "cliente", leadPlural: "clientes",
      closer: "Operação/Atendimento", sdr: "—",
      reuniao: "pedido", reuniaoPlural: "pedidos",
      ticket: "ticket médio", ciclo: "operação",
    },
    defaults: {
      ticket: 55, margin_pct: 55, win_rate: 90, meeting_show_rate: 100,
      lead_to_meeting_rate: 60, cac: 8,
      sdr_capacity_per_day: 0, closer_capacity_per_day: 80, cycle_days: 30,
    },
    offerTemplates: [
      { name: "Cardápio principal", ticket: 45, margin_pct: 60, target_sales: 1500 },
      { name: "Combos / Promoções", ticket: 75, margin_pct: 50, target_sales: 600 },
      { name: "Bebidas / Sobremesas", ticket: 18, margin_pct: 70, target_sales: 800 },
    ],
    hints: {
      ticket: "Valor médio do pedido por cliente.",
      win_rate: "Dos que olham o cardápio, quantos pedem.",
      closer_capacity: "Pedidos/dia que a operação aguenta por colaborador.",
    },
  },
  {
    id: "produto_alto_ticket",
    label: "Produto Alto Ticket (Imóveis, Carros)",
    emoji: "🏡",
    description: "Venda consultiva de bens caros com múltiplas visitas. Ex: imobiliária, concessionária, móveis sob medida.",
    hasSDR: true,
    hasMeeting: true,
    terms: {
      venda: "negócio fechado", vendaPlural: "negócios",
      lead: "interessado", leadPlural: "interessados",
      closer: "Corretor/Consultor", sdr: "Captador/Pré-atendimento",
      reuniao: "visita", reuniaoPlural: "visitas",
      ticket: "ticket médio do contrato", ciclo: "ciclo de fechamento",
    },
    defaults: {
      ticket: 350000, margin_pct: 5, win_rate: 12, meeting_show_rate: 65,
      lead_to_meeting_rate: 18, cac: 2500,
      sdr_capacity_per_day: 25, closer_capacity_per_day: 3, cycle_days: 60,
    },
    offerTemplates: [
      { name: "Produto principal", ticket: 350000, margin_pct: 5, target_sales: 4 },
      { name: "Produto entrada", ticket: 180000, margin_pct: 6, target_sales: 6 },
    ],
    hints: {
      ticket: "Valor médio do contrato (imóvel, veículo, móvel sob medida).",
      win_rate: "Das visitas realizadas, quantas viram negócio fechado (5–15% típico).",
      closer_capacity: "Visitas/dia por corretor (2–4).",
    },
  },
  {
    id: "educacao",
    label: "Educação / Cursos / Escolas",
    emoji: "🎓",
    description: "Matrícula com ciclo definido (semestre/módulo). Ex: escolas, cursos livres, EAD.",
    hasSDR: true,
    hasMeeting: true,
    terms: {
      venda: "matrícula", vendaPlural: "matrículas",
      lead: "interessado", leadPlural: "interessados",
      closer: "Consultor educacional", sdr: "Captador/Atendimento",
      reuniao: "entrevista/aula experimental", reuniaoPlural: "entrevistas",
      ticket: "ticket médio da matrícula", ciclo: "ciclo de captação",
    },
    defaults: {
      ticket: 2400, margin_pct: 55, win_rate: 30, meeting_show_rate: 60,
      lead_to_meeting_rate: 22, cac: 250,
      sdr_capacity_per_day: 35, closer_capacity_per_day: 6, cycle_days: 22,
    },
    offerTemplates: [
      { name: "Curso principal", ticket: 2400, margin_pct: 55, target_sales: 30 },
      { name: "Pós / Extensão", ticket: 5800, margin_pct: 50, target_sales: 8 },
    ],
    hints: {
      ticket: "Valor médio da matrícula (anuidade, semestre ou pacote).",
      win_rate: "Das entrevistas/aulas experimentais, quantas viram matrícula.",
      closer_capacity: "Entrevistas/dia por consultor (5–8).",
    },
  },
  {
    id: "personalizado",
    label: "Personalizado (Modo Livre)",
    emoji: "⚙️",
    description: "Configure tudo manualmente sem template.",
    hasSDR: true,
    hasMeeting: true,
    terms: {
      venda: "venda", vendaPlural: "vendas",
      lead: "lead", leadPlural: "leads",
      closer: "Closer", sdr: "SDR",
      reuniao: "reunião", reuniaoPlural: "reuniões",
      ticket: "ticket médio", ciclo: "ciclo",
    },
    defaults: {
      ticket: 1000, margin_pct: 50, win_rate: 25, meeting_show_rate: 70,
      lead_to_meeting_rate: 15, cac: 200,
      sdr_capacity_per_day: 30, closer_capacity_per_day: 4, cycle_days: 22,
    },
    offerTemplates: [],
    hints: {
      ticket: "Valor médio por venda.",
      win_rate: "Taxa de fechamento.",
      closer_capacity: "Capacidade diária do time de vendas.",
    },
  },
];

export function getBusinessModel(id?: BusinessModelId | null): BusinessModelDef {
  return BUSINESS_MODELS.find(m => m.id === id) || BUSINESS_MODELS[0];
}

// Mapeamento automático segmento → modelo padrão
export function suggestBusinessModel(segmento?: string | null): BusinessModelId {
  if (!segmento) return "b2b_consultivo";
  const map: Record<string, BusinessModelId> = {
    correspondente_bancario: "b2b_consultivo",
    consorcio: "b2b_consultivo",
    corretora_seguros: "b2b_consultivo",
    financeira: "b2b_consultivo",
    promotora_credito: "b2b_consultivo",
    consultoria: "b2b_consultivo",
    contabilidade: "b2b_consultivo",
    advocacia: "b2b_consultivo",
    marketing_agencia: "b2b_consultivo",
    tecnologia: "b2b_consultivo",
    clinica_estetica: "servico_recorrente",
    clinica_odontologica: "servico_recorrente",
    clinica_medica: "servico_recorrente",
    educacao: "educacao",
    imobiliaria: "produto_alto_ticket",
    automotivo: "produto_alto_ticket",
    varejo: "varejo_balcao",
    ecommerce: "ecommerce",
    alimentacao: "alimentacao",
    servicos_gerais: "servico_recorrente",
    outro: "personalizado",
  };
  return map[segmento] || "b2b_consultivo";
}
