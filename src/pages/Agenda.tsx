// Locked: render the official GROW OS Agenda mockup inside the app layout.
// Visual changes must be made in public/agenda.html instead of replacing with old React components.
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

function toDatePart(value?: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

function toTimePart(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function Agenda() {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    let cancelled = false;
    let currentCompanyId: string | null = null;

    const sendToIframe = (payload: Record<string, unknown>) => {
      iframeRef.current?.contentWindow?.postMessage(payload, "*");
    };

    async function loadAndSend() {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;

      let companyId = currentCompanyId;
      if (user && !companyId) {
        const { data: role } = await supabase
          .from("user_roles")
          .select("company_id")
          .eq("user_id", user.id)
          .maybeSingle();
        companyId = role?.company_id || null;
        currentCompanyId = companyId;
      }

      const agendasQuery = supabase.from("agendas").select("id, nome").order("nome");
      const profsQuery = supabase.from("profissionais").select("id, nome, especialidade").order("nome");
      const leadsQuery = supabase
        .from("leads")
        .select("id, name, phone, email")
        .order("name")
        .range(0, 999);
      const compromissosQuery = supabase
        .from("compromissos")
        .select(`
          *,
          lead:leads(id, name, phone, email),
          agenda:agendas(id, nome, tipo)
        `)
        .order("data_hora_inicio", { ascending: true })
        .limit(1000);
      const lembretesQuery = supabase
        .from("lembretes")
        .select(`
          *,
          compromisso:compromissos(
            id,
            data_hora_inicio,
            data_hora_fim,
            tipo_servico,
            titulo,
            paciente,
            lead:leads(id, name, phone, email)
          )
        `)
        .order("data_envio", { ascending: true, nullsFirst: false })
        .limit(1000);

      if (companyId) {
        agendasQuery.eq("company_id", companyId);
        profsQuery.eq("company_id", companyId);
        leadsQuery.eq("company_id", companyId);
        compromissosQuery.eq("company_id", companyId);
        lembretesQuery.eq("company_id", companyId);
      }

      const [
        { data: agendas },
        { data: profs },
        { data: leads },
        { data: compromissos, error: compromissosError },
        { data: lembretes, error: lembretesError },
      ] = await Promise.all([
        agendasQuery,
        profsQuery,
        leadsQuery,
        compromissosQuery,
        lembretesQuery,
      ]);

      if (compromissosError) console.error("[Agenda] erro ao carregar compromissos", compromissosError);
      if (lembretesError) console.error("[Agenda] erro ao carregar lembretes", lembretesError);
      if (cancelled) return;

      sendToIframe({
        type: "agenda:data",
        agendas: (agendas || []).map((a: any) => ({ id: a.id, label: a.nome })),
        profissionais: (profs || []).map((p: any) => ({
          id: p.id,
          label: p.especialidade ? `${p.nome} - ${p.especialidade}` : p.nome,
        })),
        leads: (leads || []).map((l: any) => ({
          id: l.id,
          name: l.name || "",
          phone: l.phone || "",
          email: l.email || "",
        })),
        compromissos: (compromissos || []).map((c: any) => ({
          id: c.id,
          date: toDatePart(c.data_hora_inicio),
          start: toTimePart(c.data_hora_inicio),
          end: toTimePart(c.data_hora_fim),
          type: c.tipo_servico || c.titulo || "Compromisso",
          title: c.titulo || c.tipo_servico || "Compromisso",
          name: c.lead?.name || c.paciente || c.titulo || c.tipo_servico || "Compromisso",
          client: c.lead?.name || c.paciente || "",
          agenda: c.agenda?.nome || "",
          prof: "",
          phone: c.lead?.phone || c.telefone || "",
          email: c.lead?.email || c.email_convidado || "",
          notes: c.observacoes || "",
          status: c.status || "agendado",
          remote: true,
        })),
        lembretes: (lembretes || []).map((l: any) => {
          const compromisso = l.compromisso || {};
          const envio = l.data_hora_envio || l.data_envio || l.proxima_data_envio || compromisso.data_hora_inicio;
          return {
            id: l.id,
            compromisso_id: l.compromisso_id,
            date: toDatePart(envio),
            time: toTimePart(envio),
            name: compromisso.lead?.name || compromisso.paciente || compromisso.titulo || compromisso.tipo_servico || "Lembrete",
            type: l.tipo_lembrete || "lembrete",
            channel: l.canal || "whatsapp",
            destinatario: l.destinatario || "",
            phone: l.telefone_responsavel || compromisso.lead?.phone || "",
            message: l.mensagem || "",
            status: l.status_envio || "pendente",
            appointmentDate: toDatePart(compromisso.data_hora_inicio),
            appointmentTime: toTimePart(compromisso.data_hora_inicio),
          };
        }),
      });
    }

    async function createAgenda(data: any) {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const user = userData?.user;
        if (!user) throw new Error("Usuario nao autenticado");
        const { data: role } = await supabase
          .from("user_roles")
          .select("company_id")
          .eq("user_id", user.id)
          .maybeSingle();
        const company_id = role?.company_id;
        if (!company_id) throw new Error("Empresa nao encontrada para o usuario");

        const slug = String(data.nome || "agenda")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "")
          .slice(0, 40) + "-" + Math.random().toString(36).slice(2, 7);

        const insertPayload: any = {
          nome: data.nome,
          tipo: data.tipo || "colaborador",
          tempo_medio_servico: data.tempo_medio_servico || 30,
          capacidade_simultanea: data.capacidade_simultanea || 1,
          owner_id: user.id,
          company_id,
          status: "ativo",
          slug,
          disponibilidade: data.disponibilidade || {
            dias: ["seg", "ter", "qua", "qui", "sex"],
            horario_inicio: "08:00",
            horario_fim: "18:00",
          },
          senha_acesso: data.senha_acesso || null,
        };

        const { error } = await supabase.from("agendas").insert(insertPayload);
        if (error) {
          console.error("[createAgenda] insert error", error);
          throw error;
        }

        sendToIframe({ type: "agenda:create-agenda-result", ok: true });
        await loadAndSend();
      } catch (e: any) {
        console.error("[createAgenda]", e);
        sendToIframe({ type: "agenda:create-agenda-result", ok: false, error: e?.message || "Erro ao criar agenda" });
      }
    }

    function onMessage(e: MessageEvent) {
      const d: any = e.data || {};
      if (d?.type === "agenda:ready") loadAndSend();
      if (d?.type === "agenda:create-agenda") createAgenda(d);
    }

    const compromissosChannel = supabase
      .channel("agenda-page-compromissos")
      .on("postgres_changes", { event: "*", schema: "public", table: "compromissos" }, loadAndSend)
      .subscribe();
    const lembretesChannel = supabase
      .channel("agenda-page-lembretes")
      .on("postgres_changes", { event: "*", schema: "public", table: "lembretes" }, loadAndSend)
      .subscribe();

    window.addEventListener("message", onMessage);
    const t = setTimeout(loadAndSend, 800);
    return () => {
      cancelled = true;
      window.removeEventListener("message", onMessage);
      supabase.removeChannel(compromissosChannel);
      supabase.removeChannel(lembretesChannel);
      clearTimeout(t);
    };
  }, []);

  return (
    <div className="w-full h-[calc(100vh-7rem)] min-h-[640px] overflow-hidden rounded-lg border border-border bg-background">
      <iframe
        ref={iframeRef}
        src="/agenda.html"
        title="Agenda - GROW OS"
        className="w-full h-full border-0 block"
      />
    </div>
  );
}
