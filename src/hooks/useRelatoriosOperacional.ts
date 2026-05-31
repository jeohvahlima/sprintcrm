import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BIRange, rangeToDate } from "@/hooks/useGrowSalesBI";

/** Tráfego pago: Meta, Google Ads, UTMs pagas */
const TRAFFIC_SOURCE_FILTER =
  "ad_id.not.is.null,utm_source.ilike.%meta%,utm_source.ilike.%facebook%,utm_source.ilike.%instagram%,utm_source.ilike.%google%,utm_medium.ilike.%cpc%,utm_medium.ilike.%paid%,lead_source_type.ilike.%ads%,lead_source_type.ilike.%pago%";

/** Site: pixel, formulário, chat do site, agendamento online */
const SITE_SOURCE_FILTER =
  "form_id.not.is.null,lead_source_type.eq.pixel,lead_source_type.ilike.%site%,source.ilike.%site%,source.ilike.%website%,source.ilike.%institucional%,source.ilike.%agendamento%,source.ilike.%chat-ia%,utm_source.ilike.%site%";

const DONE_TASK_STATUSES = ["concluido", "concluída", "done", "completed", "finalizado", "cancelado", "cancelada"];

export interface RelatoriosOperacional {
  tarefas: number;
  tarefasPendentes: number;
  agendamentos: number;
  agendamentosCompareceram: number;
  agendamentosNaoCompareceram: number;
  leadsTrafego: number;
  leadsSite: number;
  leadsNoFunil: number;
  leadsFunilAtivos: number;
  funilPrincipal: string | null;
  coldCallTotal: number;
  leadsTotal: number;
  atendimentosIA: number;
  leadsAtendidosIA: number;
  funisDisponiveis: { id: string; nome: string }[];
  lossReasons: { name: string; value: number }[];
}

export function useRelatoriosOperacional(range: BIRange) {
  return useQuery({
    queryKey: ["relatorios-operacional", range],
    staleTime: 60_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
    queryFn: async (): Promise<RelatoriosOperacional> => {
      const since = rangeToDate(range).toISOString();

      const [
        tasksRes,
        tasksDataRes,
        compromissosRes,
        trafegoRes,
        siteRes,
        funilPeriodoRes,
        coldcallRes,
        funilAtivosRes,
        funilLeadsRes,
        iaTrainingRes,
        iaConversasRes,
        perdidosRes,
        funisData,
        leadsTotalRes,
      ] = await Promise.all([
        supabase.from("tasks").select("*", { count: "exact", head: true }),
        supabase.from("tasks").select("id, status"),
        supabase
          .from("compromissos")
          .select("id,status", { count: "exact", head: false })
          .gte("data_hora_inicio", since),
        supabase
          .from("leads")
          .select("*", { count: "exact", head: true })
          .or(TRAFFIC_SOURCE_FILTER)
          .gte("created_at", since),
        supabase
          .from("leads")
          .select("*", { count: "exact", head: true })
          .or(SITE_SOURCE_FILTER)
          .gte("created_at", since),
        supabase
          .from("leads")
          .select("*", { count: "exact", head: true })
          .not("funil_id", "is", null)
          .gte("created_at", since),
        supabase
          .from("leads")
          .select("*", { count: "exact", head: true })
          .not("imported_to_coldcall_at", "is", null)
          .gte("imported_to_coldcall_at", since),
        supabase
          .from("leads")
          .select("*", { count: "exact", head: true })
          .not("funil_id", "is", null)
          .not("status", "eq", "ganho")
          .not("status", "eq", "perdido"),
        supabase
          .from("leads")
          .select("funil_id")
          .not("funil_id", "is", null)
          .gte("created_at", since),
        supabase
          .from("ia_training_data")
          .select("id, lead_id")
          .gte("created_at", since),
        supabase
          .from("conversas")
          .select("lead_id, numero")
          .eq("fromme", true)
          .or("sent_by.eq.bot,sent_by.ilike.%ia%,origem.eq.automacao,origem.ilike.%ia%")
          .gte("created_at", since),
        supabase
          .from("leads")
          .select("loss_reason")
          .eq("status", "perdido")
          .gte("created_at", since),
        supabase.from("funis").select("id, nome").then((r: any) => r.data || []),
        supabase.from("leads").select("*", { count: "exact", head: true }),
      ]);

      const tarefasPendentes =
        (tasksDataRes.data || []).filter(
          (t) => !DONE_TASK_STATUSES.includes((t.status || "").toLowerCase())
        ).length;

      const compareceramStatuses = ["realizado", "concluido", "concluído", "atendido"];
      const naoCompareceramStatuses = ["no_show", "no-show", "faltou", "nao_compareceu", "não compareceu"];
      let agendamentosCompareceram = 0;
      let agendamentosNaoCompareceram = 0;
      (compromissosRes.data || []).forEach((c) => {
        const status = (c.status || "").toLowerCase();
        if (compareceramStatuses.includes(status)) agendamentosCompareceram += 1;
        if (naoCompareceramStatuses.includes(status)) agendamentosNaoCompareceram += 1;
      });

      const funilCountMap: Record<string, number> = {};
      (funilLeadsRes.data || []).forEach((l) => {
        if (l.funil_id) funilCountMap[l.funil_id] = (funilCountMap[l.funil_id] || 0) + 1;
      });
      const topFunilId = Object.entries(funilCountMap).sort((a, b) => b[1] - a[1])[0]?.[0];
      const funilPrincipal =
        (funisRes.data || []).find((f) => f.id === topFunilId)?.nome || null;

      const iaLeadIds = new Set<string>();
      (iaTrainingRes.data || []).forEach((row) => {
        if (row.lead_id) iaLeadIds.add(row.lead_id);
      });
      (iaConversasRes.data || []).forEach((row) => {
        if (row.lead_id) iaLeadIds.add(row.lead_id);
      });

      const lossAgg: Record<string, number> = {};
      (perdidosRes.data || []).forEach((l) => {
        const reason = (l.loss_reason || "Não informado").trim();
        const label =
          reason === "preco"
            ? "Preço alto"
            : reason === "sem_urgencia"
              ? "Sem urgência"
              : reason === "concorrente"
                ? "Concorrente"
                : reason === "sem_orcamento"
                  ? "Sem orçamento"
                  : reason === "nao_atendeu"
                    ? "Não atendeu"
                    : reason;
        lossAgg[label] = (lossAgg[label] || 0) + 1;
      });

      const lossReasons = Object.entries(lossAgg)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8);

      return {
        tarefas: tasksRes.count || 0,
        tarefasPendentes,
        agendamentos: compromissosRes.data?.length || 0,
        agendamentosCompareceram,
        agendamentosNaoCompareceram,
        leadsTrafego: trafegoRes.count || 0,
        leadsSite: siteRes.count || 0,
        leadsNoFunil: funilPeriodoRes.count || 0,
        leadsFunilAtivos: funilAtivosRes.count || 0,
        funilPrincipal,
        coldCallTotal: coldcallRes.count || 0,
        leadsTotal: leadsTotalRes.count || 0,
        atendimentosIA: iaTrainingRes.data?.length || 0,
        leadsAtendidosIA: iaLeadIds.size,
        funisDisponiveis: (funisData || []).map((f: any) => ({ id: f.id, nome: f.nome })),
        lossReasons,
      };
    },
  });
}
