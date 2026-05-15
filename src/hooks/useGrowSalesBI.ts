import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type BIRange = "7d" | "30d" | "90d" | "ytd";

const rangeToDate = (r: BIRange): Date => {
  const d = new Date();
  if (r === "7d") d.setDate(d.getDate() - 7);
  else if (r === "30d") d.setDate(d.getDate() - 30);
  else if (r === "90d") d.setDate(d.getDate() - 90);
  else d.setMonth(0, 1);
  d.setHours(0, 0, 0, 0);
  return d;
};

export interface BISnapshot {
  range: BIRange;
  receita: {
    bruto: number;
    ticketMedio: number;
    ltv: number;
    deals: number;
    porCanal: { canal: string; valor: number; deals: number }[];
    porVendedor: { user: string; valor: number; deals: number }[];
    porMes: { mes: string; valor: number }[];
  };
  funil: {
    leadsNovos: number;
    agendados: number;
    compareceram: number;
    fechados: number;
    perdidos: number;
    convAgenda: number;
    convCompareceu: number;
    convFechamento: number;
    gargalo: string;
  };
  perdas: {
    noShow: { qty: number; valor: number };
    leadSemResposta: { qty: number; valor: number };
    semFollowUp: { qty: number; valor: number };
    perdidos: { qty: number; valor: number };
    total: number;
  };
  performance: {
    sdrs: { user: string; leads: number; agendados: number; conv: number }[];
    closers: { user: string; oportunidades: number; ganhos: number; receita: number; conv: number }[];
  };
  forecast: {
    pipelineAberto: number;
    forecast30d: number;
    forecast60d: number;
    forecast90d: number;
    metaAtual: number;
    realizadoAtual: number;
    pctMeta: number;
  };
  campanhas: {
    porCampanha: { campanha: string; leads: number; ganhos: number; receita: number; conv: number }[];
    porFonte: { fonte: string; leads: number; ganhos: number; receita: number }[];
  };
  insights: { tipo: "alerta" | "oportunidade" | "ok"; titulo: string; descricao: string }[];
  generatedAt: string;
}

const safeNum = (v: any, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

async function fetchAllPaginated<T>(
  builder: () => any,
  pageSize = 1000
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await builder().range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...(data as T[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

export function useGrowSalesBI(range: BIRange = "30d") {
  return useQuery({
    queryKey: ["grow-sales-bi", range],
    staleTime: 60_000,
    queryFn: async (): Promise<BISnapshot> => {
      const since = rangeToDate(range).toISOString();

      // Parallel fetch
      const [companyRes, leadsRaw, compromissosRaw, goalsRaw, profilesRaw] = await Promise.all([
        supabase.rpc("get_my_company_id"),
        fetchAllPaginated<any>(() =>
          supabase
            .from("leads")
            .select(
              "id,name,value,status,stage,owner_id,responsavel_id,source,utm_source,utm_campaign,utm_medium,lead_source_type,ad_id,won_at,lost_at,created_at,updated_at,last_engagement_at,probability,expected_close_date,etapa_id,funil_id"
            )
            .gte("created_at", since)
            .order("created_at", { ascending: false })
        ),
        fetchAllPaginated<any>(() =>
          supabase
            .from("compromissos")
            .select("id,lead_id,status,data_hora_inicio,custo_estimado,owner_id,usuario_responsavel_id,created_at")
            .gte("data_hora_inicio", since)
        ),
        supabase
          .from("commercial_goals")
          .select("metric,target_value,start_date,end_date,active,role_target,scope")
          .eq("active", true)
          .lte("start_date", new Date().toISOString().slice(0, 10))
          .gte("end_date", new Date().toISOString().slice(0, 10))
          .then((r: any) => r.data || []),
        supabase.from("profiles").select("id,full_name,email").then((r: any) => r.data || []),
      ]);

      const companyId = (companyRes as any)?.data;
      const leads = leadsRaw as any[];
      const compromissos = compromissosRaw as any[];
      const goals = goalsRaw as any[];
      const profiles = profilesRaw as any[];

      const userName = (id?: string | null) => {
        if (!id) return "Sem responsável";
        const p = profiles.find((x) => x.id === id);
        return p?.full_name || p?.email || "Usuário";
      };

      // ============= RECEITA =============
      const ganhos = leads.filter((l) => l.status === "ganho" || l.won_at);
      const bruto = ganhos.reduce((s, l) => s + safeNum(l.value), 0);
      const deals = ganhos.length;
      const ticketMedio = deals > 0 ? bruto / deals : 0;

      // LTV simplificado: receita média por contato único
      const contatosUnicos = new Set(ganhos.map((l) => l.name?.toLowerCase().trim() || l.id));
      const ltv = contatosUnicos.size > 0 ? bruto / contatosUnicos.size : 0;

      const canalAgg: Record<string, { valor: number; deals: number }> = {};
      ganhos.forEach((l) => {
        const c = l.utm_source || l.source || l.lead_source_type || "Direto";
        if (!canalAgg[c]) canalAgg[c] = { valor: 0, deals: 0 };
        canalAgg[c].valor += safeNum(l.value);
        canalAgg[c].deals += 1;
      });
      const porCanal = Object.entries(canalAgg)
        .map(([canal, v]) => ({ canal, ...v }))
        .sort((a, b) => b.valor - a.valor);

      const vendedorAgg: Record<string, { valor: number; deals: number }> = {};
      ganhos.forEach((l) => {
        const u = userName(l.owner_id || l.responsavel_id);
        if (!vendedorAgg[u]) vendedorAgg[u] = { valor: 0, deals: 0 };
        vendedorAgg[u].valor += safeNum(l.value);
        vendedorAgg[u].deals += 1;
      });
      const porVendedor = Object.entries(vendedorAgg)
        .map(([user, v]) => ({ user, ...v }))
        .sort((a, b) => b.valor - a.valor);

      // Receita por mês (últimos 6)
      const mesAgg: Record<string, number> = {};
      ganhos.forEach((l) => {
        const dt = new Date(l.won_at || l.updated_at || l.created_at);
        const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
        mesAgg[key] = (mesAgg[key] || 0) + safeNum(l.value);
      });
      const porMes = Object.entries(mesAgg)
        .map(([mes, valor]) => ({ mes, valor }))
        .sort((a, b) => a.mes.localeCompare(b.mes))
        .slice(-6);

      // ============= FUNIL =============
      const leadsNovos = leads.length;
      const leadIdsAgendados = new Set(compromissos.map((c) => c.lead_id).filter(Boolean));
      const agendados = leadIdsAgendados.size;
      const compareceramSet = new Set(
        compromissos
          .filter((c) => ["realizado", "concluido", "concluído", "atendido"].includes((c.status || "").toLowerCase()))
          .map((c) => c.lead_id)
          .filter(Boolean)
      );
      const compareceram = compareceramSet.size;
      const fechados = ganhos.length;
      const perdidosCount = leads.filter((l) => l.status === "perdido" || l.lost_at).length;
      const convAgenda = leadsNovos > 0 ? (agendados / leadsNovos) * 100 : 0;
      const convCompareceu = agendados > 0 ? (compareceram / agendados) * 100 : 0;
      const convFechamento = compareceram > 0 ? (fechados / compareceram) * 100 : 0;
      const taxas = [
        { nome: "Lead → Agendamento", taxa: convAgenda },
        { nome: "Agendamento → Comparecimento", taxa: convCompareceu },
        { nome: "Comparecimento → Fechamento", taxa: convFechamento },
      ];
      const gargalo = taxas.sort((a, b) => a.taxa - b.taxa)[0]?.nome || "—";

      // ============= PERDAS OCULTAS =============
      const noShowList = compromissos.filter((c) =>
        ["no_show", "no-show", "faltou", "nao_compareceu", "não compareceu"].includes((c.status || "").toLowerCase())
      );
      const noShowValor = noShowList.reduce((s, c) => {
        const lead = leads.find((l) => l.id === c.lead_id);
        return s + safeNum(lead?.value || c.custo_estimado);
      }, 0);

      // Lead sem resposta: criado há mais de 24h, sem last_engagement, status novo/contato
      const agora = Date.now();
      const semResposta = leads.filter((l) => {
        const idade = (agora - new Date(l.created_at).getTime()) / 1000 / 3600;
        return idade > 24 && !l.last_engagement_at && !l.won_at && !l.lost_at;
      });
      const semRespostaValor = semResposta.reduce((s, l) => s + safeNum(l.value), 0);

      // Sem follow-up: último engagement > 7 dias e status ativo
      const semFollow = leads.filter((l) => {
        if (l.won_at || l.lost_at) return false;
        if (!l.last_engagement_at) return false;
        const dias = (agora - new Date(l.last_engagement_at).getTime()) / 1000 / 3600 / 24;
        return dias > 7;
      });
      const semFollowValor = semFollow.reduce((s, l) => s + safeNum(l.value), 0);

      const perdidosArr = leads.filter((l) => l.status === "perdido" || l.lost_at);
      const perdidosValor = perdidosArr.reduce((s, l) => s + safeNum(l.value), 0);

      const perdas = {
        noShow: { qty: noShowList.length, valor: noShowValor },
        leadSemResposta: { qty: semResposta.length, valor: semRespostaValor },
        semFollowUp: { qty: semFollow.length, valor: semFollowValor },
        perdidos: { qty: perdidosArr.length, valor: perdidosValor },
        total: noShowValor + semRespostaValor + semFollowValor + perdidosValor,
      };

      // ============= PERFORMANCE =============
      const sdrAgg: Record<string, { leads: number; agendados: number }> = {};
      leads.forEach((l) => {
        const u = userName(l.owner_id || l.responsavel_id);
        if (!sdrAgg[u]) sdrAgg[u] = { leads: 0, agendados: 0 };
        sdrAgg[u].leads += 1;
        if (leadIdsAgendados.has(l.id)) sdrAgg[u].agendados += 1;
      });
      const sdrs = Object.entries(sdrAgg)
        .map(([user, v]) => ({
          user,
          leads: v.leads,
          agendados: v.agendados,
          conv: v.leads > 0 ? (v.agendados / v.leads) * 100 : 0,
        }))
        .sort((a, b) => b.leads - a.leads)
        .slice(0, 10);

      const closerAgg: Record<string, { oportunidades: number; ganhos: number; receita: number }> = {};
      leads.forEach((l) => {
        if (!compareceramSet.has(l.id) && !ganhos.includes(l) && !perdidosArr.includes(l)) return;
        const u = userName(l.owner_id || l.responsavel_id);
        if (!closerAgg[u]) closerAgg[u] = { oportunidades: 0, ganhos: 0, receita: 0 };
        closerAgg[u].oportunidades += 1;
        if (l.status === "ganho" || l.won_at) {
          closerAgg[u].ganhos += 1;
          closerAgg[u].receita += safeNum(l.value);
        }
      });
      const closers = Object.entries(closerAgg)
        .map(([user, v]) => ({
          user,
          ...v,
          conv: v.oportunidades > 0 ? (v.ganhos / v.oportunidades) * 100 : 0,
        }))
        .sort((a, b) => b.receita - a.receita)
        .slice(0, 10);

      // ============= FORECAST =============
      const abertos = leads.filter((l) => !l.won_at && !l.lost_at && l.status !== "perdido" && l.status !== "ganho");
      const pipelineAberto = abertos.reduce((s, l) => s + safeNum(l.value), 0);
      const dentroDias = (l: any, days: number) => {
        if (!l.expected_close_date) return false;
        const dt = new Date(l.expected_close_date).getTime();
        return dt >= agora && dt <= agora + days * 86400000;
      };
      const weighted = (l: any) => safeNum(l.value) * (safeNum(l.probability, 50) / 100);
      const forecast30 = abertos.filter((l) => dentroDias(l, 30)).reduce((s, l) => s + weighted(l), 0);
      const forecast60 = abertos.filter((l) => dentroDias(l, 60)).reduce((s, l) => s + weighted(l), 0);
      const forecast90 = abertos.filter((l) => dentroDias(l, 90)).reduce((s, l) => s + weighted(l), 0);

      const metaReceita = goals.find((g) => g.metric === "receita" || g.metric === "revenue");
      const metaAtual = safeNum(metaReceita?.target_value);
      const realizadoAtual = bruto;
      const pctMeta = metaAtual > 0 ? (realizadoAtual / metaAtual) * 100 : 0;

      // ============= CAMPANHAS =============
      const campAgg: Record<string, { leads: number; ganhos: number; receita: number }> = {};
      leads.forEach((l) => {
        const c = l.utm_campaign || l.ad_id || "Sem campanha";
        if (!campAgg[c]) campAgg[c] = { leads: 0, ganhos: 0, receita: 0 };
        campAgg[c].leads += 1;
        if (l.status === "ganho" || l.won_at) {
          campAgg[c].ganhos += 1;
          campAgg[c].receita += safeNum(l.value);
        }
      });
      const porCampanha = Object.entries(campAgg)
        .map(([campanha, v]) => ({
          campanha,
          ...v,
          conv: v.leads > 0 ? (v.ganhos / v.leads) * 100 : 0,
        }))
        .sort((a, b) => b.receita - a.receita)
        .slice(0, 15);

      const fonteAgg: Record<string, { leads: number; ganhos: number; receita: number }> = {};
      leads.forEach((l) => {
        const f = l.utm_source || l.source || l.lead_source_type || "Direto";
        if (!fonteAgg[f]) fonteAgg[f] = { leads: 0, ganhos: 0, receita: 0 };
        fonteAgg[f].leads += 1;
        if (l.status === "ganho" || l.won_at) {
          fonteAgg[f].ganhos += 1;
          fonteAgg[f].receita += safeNum(l.value);
        }
      });
      const porFonte = Object.entries(fonteAgg)
        .map(([fonte, v]) => ({ fonte, ...v }))
        .sort((a, b) => b.receita - a.receita);

      // ============= IA INSIGHTS (regras) =============
      const insights: BISnapshot["insights"] = [];
      if (perdas.noShow.qty > 0) {
        insights.push({
          tipo: "alerta",
          titulo: `${perdas.noShow.qty} no-shows custaram ${formatBRL(perdas.noShow.valor)}`,
          descricao: "Reduzir no-show com lembrete 24h e 1h antes pode recuperar até 30% dessa receita.",
        });
      }
      if (perdas.leadSemResposta.qty > 5) {
        insights.push({
          tipo: "alerta",
          titulo: `${perdas.leadSemResposta.qty} leads sem primeira resposta há +24h`,
          descricao: `Pipeline parado de ${formatBRL(perdas.leadSemResposta.valor)}. Atribua um SDR ou ative IA de atendimento.`,
        });
      }
      if (convFechamento > 0 && convFechamento < 20) {
        insights.push({
          tipo: "alerta",
          titulo: `Taxa de fechamento baixa: ${convFechamento.toFixed(1)}%`,
          descricao: "Revise script comercial e qualificação BANT/SPIN no playbook.",
        });
      }
      if (gargalo) {
        insights.push({
          tipo: "oportunidade",
          titulo: `Gargalo principal: ${gargalo}`,
          descricao: "Concentre energia desta semana nesta etapa para maximizar receita.",
        });
      }
      if (porCanal[0] && porCanal.length > 1) {
        insights.push({
          tipo: "ok",
          titulo: `Canal campeão: ${porCanal[0].canal} (${formatBRL(porCanal[0].valor)})`,
          descricao: `Considere aumentar investimento neste canal — responde por ${((porCanal[0].valor / Math.max(bruto, 1)) * 100).toFixed(0)}% da receita.`,
        });
      }
      if (metaAtual > 0 && pctMeta < 60) {
        insights.push({
          tipo: "alerta",
          titulo: `Meta em risco: ${pctMeta.toFixed(0)}% do target`,
          descricao: `Faltam ${formatBRL(Math.max(metaAtual - realizadoAtual, 0))} para bater a meta do período.`,
        });
      }

      return {
        range,
        receita: { bruto, ticketMedio, ltv, deals, porCanal, porVendedor, porMes },
        funil: {
          leadsNovos,
          agendados,
          compareceram,
          fechados,
          perdidos: perdidosCount,
          convAgenda,
          convCompareceu,
          convFechamento,
          gargalo,
        },
        perdas,
        performance: { sdrs, closers },
        forecast: {
          pipelineAberto,
          forecast30d: forecast30,
          forecast60d: forecast60,
          forecast90d: forecast90,
          metaAtual,
          realizadoAtual,
          pctMeta,
        },
        campanhas: { porCampanha, porFonte },
        insights,
        generatedAt: new Date().toISOString(),
      };
    },
  });
}

export const formatBRL = (v: number) =>
  (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export const formatPct = (v: number) => `${(v || 0).toFixed(1)}%`;
