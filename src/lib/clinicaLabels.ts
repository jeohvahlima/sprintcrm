/**
 * Labels adaptáveis para empresas do segmento Clínica.
 * Uso: `leadLabel(isClinica)` → "Paciente" | "Lead"
 *
 * Quando `isClinica = false`, retornamos o termo comercial original.
 * Objetivo: aplicar em toda a UI sem alterar o backend.
 */

export const leadLabel = (isClinica: boolean, plural = false) =>
  isClinica ? (plural ? "Pacientes" : "Paciente") : (plural ? "Leads" : "Lead");

export const newLeadLabel = (isClinica: boolean) =>
  isClinica ? "Novo Paciente" : "Novo Lead";

export const dealLabel = (isClinica: boolean) =>
  isClinica ? "Atendimento" : "Negócio";

export const opportunityLabel = (isClinica: boolean) =>
  isClinica ? "consultas" : "oportunidades";

export const saleLabel = (isClinica: boolean) =>
  isClinica ? "Procedimento" : "Venda";

export const funnelLabel = (isClinica: boolean) =>
  isClinica ? "Jornada do Paciente" : "Funil de Vendas";

export const followUpLabel = (isClinica: boolean) =>
  isClinica ? "Pós-consulta" : "Follow-up";

export const followUpFunnelLabel = (isClinica: boolean) =>
  isClinica ? "Funil de Pós-consulta" : "Funil de Follow-up";

export const contactsLabel = (isClinica: boolean) =>
  isClinica ? "Pacientes" : "Contatos";

export const reportsLabel = (isClinica: boolean) =>
  isClinica ? "Painel Clínico" : "Relatórios";

export const chatLabel = (isClinica: boolean) =>
  isClinica ? "Atendimento" : "Bate-Papo";

/**
 * Mapeia nomes de etapas comerciais para nomes clínicos.
 * Não altera dados no banco — apenas renderização.
 */
const STAGE_MAP_CLINICA: Record<string, string> = {
  "Novo Lead": "Novo paciente",
  "Lead": "Paciente",
  "Lead Qualificado": "Paciente qualificado",
  "Em Negociação": "Em atendimento",
  "Proposta Enviada": "Proposta apresentada",
  "Negociação": "Em atendimento",
  "Ganho": "Atendido",
  "Fechado": "Atendido",
  "Vendido": "Procedimento realizado",
  "Perdido": "Não compareceu",
  "Agendamento Feito": "Agendado",
  "Confirmado": "Confirmado",
  "Atendido": "Atendido",
  "Retorno": "Retorno",
};

export const stageLabel = (nome: string, isClinica: boolean) => {
  if (!isClinica) return nome;
  return STAGE_MAP_CLINICA[nome] ?? nome;
};
