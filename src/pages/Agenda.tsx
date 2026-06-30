// Locked: render the official GROW OS Agenda mockup inside the app layout.
// Visual changes must be made in public/agenda.html instead of replacing with old React components.
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const AGENDA_HTML_VERSION = "agenda-fix-20260629-app-agenda-top-button";

function toDatePart(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value.slice(0, 10);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toTimePart(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function normalizePhoneBR(phone?: string | null) {
  const cleaned = String(phone || "").replace(/\D/g, "");
  if (!cleaned) return "";
  if (cleaned.startsWith("55")) return cleaned;
  return `55${cleaned}`;
}

function buildDateTime(date: string, time: string) {
  return new Date(`${date}T${time || "00:00"}`).toISOString();
}

function addMinutes(date: string, time: string, minutes: number) {
  const d = new Date(`${date}T${time || "00:00"}`);
  d.setMinutes(d.getMinutes() + minutes);
  return d.toISOString();
}

function reminderDate(startIso: string, minutesBefore: number) {
  const d = new Date(startIso);
  d.setMinutes(d.getMinutes() - minutesBefore);
  return d.toISOString();
}

export default function Agenda() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeReady, setIframeReady] = useState(false);
  const iframeSrc = useMemo(
    () => `/agenda.html?v=${AGENDA_HTML_VERSION}`,
    []
  );

  useEffect(() => {
    let active = true;

    async function clearStaleAgendaCache() {
      try {
        if ("serviceWorker" in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((reg) => reg.unregister()));
        }

        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(
            keys
              .filter((key) => key.toLowerCase().includes("workbox") || key.toLowerCase().includes("precache"))
              .map((key) => caches.delete(key))
          );
        }
      } catch (error) {
        console.warn("[Agenda] nao foi possivel limpar cache antigo", error);
      } finally {
        if (active) setIframeReady(true);
      }
    }

    clearStaleAgendaCache();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!iframeReady) return;

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

      const agendasQuery = supabase.from("agendas").select("id, nome, tipo, status, capacidade_simultanea, tempo_medio_servico, disponibilidade, senha_acesso, slug, responsavel_id, avatar_url, bio, created_at, updated_at").order("nome");
      const profsQuery = supabase.from("profissionais").select("id, nome, especialidade").order("nome");
      const leadsQuery = supabase
        .from("leads")
        .select("id, name, phone, telefone, email, profile_picture_url")
        .order("name");
      const compromissosQuery = supabase
        .from("compromissos")
        .select(`
          *,
          lead:leads(id, name, phone, email, profile_picture_url),
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
        compromissosQuery.or(
          `company_id.eq.${companyId},owner_id.eq.${user?.id},usuario_responsavel_id.eq.${user?.id}`
        );
        lembretesQuery.eq("company_id", companyId);
      } else if (user) {
        compromissosQuery.or(`owner_id.eq.${user.id},usuario_responsavel_id.eq.${user.id}`);
      }

      const [
        { data: agendas },
        { data: profs },
        { data: compromissos, error: compromissosError },
        { data: lembretes, error: lembretesError },
      ] = await Promise.all([
        agendasQuery,
        profsQuery,
        compromissosQuery,
        lembretesQuery,
      ]);

      const allLeads: any[] = [];
      const pageSize = 1000;
      for (let from = 0; ; from += pageSize) {
        const { data: leadsPage, error: leadsError } = await leadsQuery.range(from, from + pageSize - 1);
        if (leadsError) {
          console.error("[Agenda] erro ao carregar contatos", leadsError);
          break;
        }
        allLeads.push(...(leadsPage || []));
        if (!leadsPage || leadsPage.length < pageSize) break;
      }

      if (compromissosError) console.error("[Agenda] erro ao carregar compromissos", compromissosError);
      if (lembretesError) console.error("[Agenda] erro ao carregar lembretes", lembretesError);
      if (cancelled) return;

      sendToIframe({
        type: "agenda:data",
        agendas: (agendas || []).map((a: any) => ({
          id: a.id,
          label: a.nome,
          nome: a.nome,
          tipo: a.tipo || "colaborador",
          status: a.status || "ativo",
          capacidade_simultanea: a.capacidade_simultanea || 1,
          tempo_medio_servico: a.tempo_medio_servico || 30,
          disponibilidade: a.disponibilidade || null,
          senha_acesso: a.senha_acesso || null,
          slug: a.slug || null,
          responsavel_id: a.responsavel_id || null,
          avatar_url: a.avatar_url || null,
          bio: a.bio || null,
        })),
        profissionais: (profs || []).map((p: any) => ({
          id: p.id,
          label: p.especialidade ? `${p.nome} - ${p.especialidade}` : p.nome,
        })),
        leads: allLeads.map((l: any) => ({
          id: l.id,
          name: l.name || "",
          phone: l.phone || l.telefone || "",
          email: l.email || "",
          avatarUrl: l.profile_picture_url || null,
        })),
        compromissos: (compromissos || []).map((c: any) => ({
          id: c.id,
          date: toDatePart(c.data_hora_inicio),
          start: toTimePart(c.data_hora_inicio),
          end: toTimePart(c.data_hora_fim),
          type: c.tipo_servico || c.titulo || "Compromisso",
          title: c.titulo || c.tipo_servico || "Compromisso",
          leadId: c.lead_id || null,
          name: c.lead?.name || c.paciente || c.titulo || c.tipo_servico || "Compromisso",
          client: c.lead?.name || c.paciente || "",
          agenda: c.agenda?.nome || "",
          prof: "",
          phone: c.lead?.phone || c.telefone || "",
          email: c.lead?.email || c.email_convidado || "",
          avatarUrl: c.lead?.profile_picture_url || null,
          notes: c.observacoes || "",
          status: c.status_confirmacao || c.status || "agendado",
          value: c.custo_estimado || c.valor || 0,
          remWa: c.lembrete_whatsapp_24h ?? true,
          remEmail: c.lembrete_email_24h ?? false,
          confirmNow: c.enviar_confirmacao ?? true,
          remTime: "60",
          meta: {
            notes: c.observacoes || "",
            tags: Array.isArray(c.tags_rapidas) ? c.tags_rapidas : [],
            tasks: Array.isArray(c.tarefas) ? c.tarefas : [],
          },
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

    async function sendAppointmentConfirmation({
      compromisso,
      payload,
      companyId,
    }: {
      compromisso: any;
      payload: any;
      companyId: string;
    }) {
      const phone = normalizePhoneBR(payload.phone);
      if (!phone) return { skipped: "sem telefone" };

      const [year, month, day] = String(payload.date || "").split("-");
      const dateText = day && month && year ? `${day}/${month}/${year}` : payload.date;
      const confirmToken = compromisso?.confirmation_token;
      const link = confirmToken ? `${window.location.origin}/c/${confirmToken}` : "";
      const serviceLine = payload.type ? `\n*Tipo:* ${payload.type}` : "";
      const notesLine = payload.notes ? `\n\n*Observacoes:*\n${payload.notes}` : "";
      const linkLine = link ? `\n\nConfirme seu agendamento pelo link:\n${link}` : "";
      const mensagem =
        `*Compromisso Agendado!*\n\n` +
        `Ola ${payload.name}! Seu compromisso foi agendado com sucesso.\n\n` +
        `*Data:* ${dateText}\n` +
        `*Horario:* ${payload.start} as ${payload.end || ""}` +
        serviceLine +
        notesLine +
        `\n\n*Status:* Aguardando sua confirmacao` +
        linkLine +
        `\n\n_Esta e uma mensagem automatica do seu agendamento._`;

      const { data, error } = await supabase.functions.invoke("enviar-whatsapp", {
        body: {
          numero: phone,
          mensagem,
          company_id: companyId,
          lead_id: payload.leadId || null,
        },
      });

      if (error || !(data as any)?.success) {
        console.error("[Agenda] falha ao enviar confirmacao WhatsApp", error || data);
        return { error: error?.message || "Falha ao enviar WhatsApp" };
      }
      return { success: true };
    }

    async function createReminder(compromissoId: string, payload: any, companyId: string, userId: string, startIso: string) {
      const minutesBefore = Number(payload.remTime || 60);
      const reminders: any[] = [];
      const message =
        `Lembrete: ${payload.name}, voce tem um compromisso ` +
        `${payload.date} as ${payload.start}${payload.type ? ` (${payload.type})` : ""}.`;

      if (payload.remWa && payload.phone) {
        reminders.push({
          compromisso_id: compromissoId,
          canal: "whatsapp",
          destinatario: "lead",
          horas_antecedencia: Math.max(1, Math.round(minutesBefore / 60)),
          data_envio: reminderDate(startIso, minutesBefore),
          data_hora_envio: reminderDate(startIso, minutesBefore),
          status_envio: "pendente",
          telefone_responsavel: payload.phone,
          mensagem: message,
          tipo_lembrete: "compromisso",
          company_id: companyId,
          created_by: userId,
          ativo: true,
        });
      }

      if (payload.remEmail && payload.email) {
        reminders.push({
          compromisso_id: compromissoId,
          canal: "email",
          destinatario: "lead",
          horas_antecedencia: Math.max(1, Math.round(minutesBefore / 60)),
          data_envio: reminderDate(startIso, minutesBefore),
          data_hora_envio: reminderDate(startIso, minutesBefore),
          status_envio: "pendente",
          mensagem: message,
          tipo_lembrete: "compromisso",
          company_id: companyId,
          created_by: userId,
          ativo: true,
        });
      }

      if (reminders.length) {
        const { error } = await supabase.from("lembretes").insert(reminders);
        if (error) console.warn("[Agenda] falha ao criar lembretes", error);
      }
    }

    async function saveCompromisso(data: any) {
      try {
        const payload = data.payload || data;
        const { data: userData } = await supabase.auth.getUser();
        const user = userData?.user;
        if (!user) throw new Error("Usuario nao autenticado");

        const { data: role } = await supabase
          .from("user_roles")
          .select("company_id")
          .eq("user_id", user.id)
          .maybeSingle();
        const companyId = role?.company_id;
        if (!companyId) throw new Error("Empresa nao encontrada para o usuario");

        const startIso = buildDateTime(payload.date, payload.start);
        const endIso = payload.end
          ? buildDateTime(payload.date, payload.end)
          : addMinutes(payload.date, payload.start, 30);
        const duration = Math.max(
          1,
          Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000)
        );

        const dbPayload: any = {
          agenda_id: payload.agendaId || null,
          profissional_id: payload.profId || null,
          lead_id: payload.leadId || null,
          paciente: payload.name || null,
          telefone: payload.phone || null,
          email_convidado: payload.email || null,
          tipo_servico: payload.type || "Compromisso",
          titulo: payload.type || "Compromisso",
          observacoes: payload.notes || null,
          custo_estimado: Number(payload.value || 0) || null,
          data_hora_inicio: startIso,
          data_hora_fim: endIso,
          duracao: duration,
          status: payload.status || "agendado",
          status_confirmacao: "pendente",
          convidar_lead_email: Boolean(payload.confirmEmail),
          lembretes_config: {
            whatsapp: Boolean(payload.remWa),
            email: Boolean(payload.remEmail),
            antecedencia_minutos: Number(payload.remTime || 60),
            confirmacao_imediata_whatsapp: Boolean(payload.confirmNow),
          },
          owner_id: user.id,
          usuario_responsavel_id: user.id,
          company_id: companyId,
        };

        const isRemoteId = payload.id && !String(payload.id).startsWith("a_");
        const query = isRemoteId
          ? supabase.from("compromissos").update(dbPayload).eq("id", payload.id).select("id, confirmation_token").single()
          : supabase.from("compromissos").insert(dbPayload).select("id, confirmation_token").single();

        const { data: compromisso, error } = await query;
        if (error) throw error;

        if (!isRemoteId) {
          await createReminder(compromisso.id, payload, companyId, user.id, startIso);
        }

        const confirmation = payload.confirmNow
          ? await sendAppointmentConfirmation({ compromisso, payload, companyId })
          : { skipped: "nao solicitado" };

        sendToIframe({
          type: "agenda:save-result",
          ok: true,
          id: compromisso.id,
          confirmation,
          message: confirmation?.success
            ? "Compromisso salvo e confirmacao WhatsApp enviada"
            : "Compromisso salvo",
        });
        await loadAndSend();
      } catch (e: any) {
        console.error("[Agenda] erro ao salvar compromisso", e);
        sendToIframe({
          type: "agenda:save-result",
          ok: false,
          error: e?.message || "Erro ao salvar compromisso",
        });
      }
    }

    async function uploadAgendaAvatar(dataUrl: string, userId: string): Promise<string | null> {
      try {
        if (!dataUrl || !dataUrl.startsWith("data:")) return null;
        const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (!match) return null;
        const mime = match[1];
        const b64 = match[2];
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const ext = (mime.split("/")[1] || "png").replace("jpeg", "jpg");
        const path = `agendas/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage
          .from("user-avatars")
          .upload(path, bytes, { contentType: mime, upsert: false, cacheControl: "3600" });
        if (error) {
          console.error("[uploadAgendaAvatar] upload error", error);
          return null;
        }
        const { data } = supabase.storage.from("user-avatars").getPublicUrl(path);
        return data.publicUrl;
      } catch (e) {
        console.error("[uploadAgendaAvatar]", e);
        return null;
      }
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

        let avatarUrl: string | null = data.avatar_url ?? null;
        if (data.avatar_data_url) {
          avatarUrl = (await uploadAgendaAvatar(data.avatar_data_url, user.id)) || avatarUrl;
        }

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
          avatar_url: avatarUrl,
          bio: data.bio ?? null,
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

    async function updateAgenda(data: any) {
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
        if (!data.id) throw new Error("Agenda nao informada");

        let avatarUrl: string | null | undefined = undefined;
        if (data.avatar_data_url) {
          avatarUrl = await uploadAgendaAvatar(data.avatar_data_url, user.id);
        } else if (typeof data.avatar_url !== "undefined") {
          avatarUrl = data.avatar_url;
        }

        const updatePayload: any = {
          nome: data.nome,
          tipo: data.tipo || "colaborador",
          tempo_medio_servico: data.tempo_medio_servico || 30,
          capacidade_simultanea: data.capacidade_simultanea || 1,
          disponibilidade: data.disponibilidade || {
            dias: ["seg", "ter", "qua", "qui", "sex"],
            horario_inicio: "08:00",
            horario_fim: "18:00",
          },
          senha_acesso: data.senha_acesso || null,
          updated_at: new Date().toISOString(),
        };
        if (typeof avatarUrl !== "undefined") updatePayload.avatar_url = avatarUrl;
        if (typeof data.bio !== "undefined") updatePayload.bio = data.bio;

        const { error } = await supabase
          .from("agendas")
          .update(updatePayload)
          .eq("id", data.id)
          .eq("company_id", company_id);
        if (error) throw error;

        sendToIframe({ type: "agenda:agenda-result", action: "update", ok: true });
        await loadAndSend();
      } catch (e: any) {
        console.error("[updateAgenda]", e);
        sendToIframe({ type: "agenda:agenda-result", action: "update", ok: false, error: e?.message || "Erro ao atualizar agenda" });
      }
    }

    async function deleteAgenda(data: any) {
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
        if (!data.id) throw new Error("Agenda nao informada");

        const { error } = await supabase
          .from("agendas")
          .delete()
          .eq("id", data.id)
          .eq("company_id", company_id);
        if (error) throw error;

        sendToIframe({ type: "agenda:agenda-result", action: "delete", ok: true });
        await loadAndSend();
      } catch (e: any) {
        console.error("[deleteAgenda]", e);
        sendToIframe({ type: "agenda:agenda-result", action: "delete", ok: false, error: e?.message || "Erro ao excluir agenda" });
      }
    }

    async function saveCompromissoMeta(data: any) {
      try {
        const id = data?.id;
        if (!id || String(id).startsWith("a_")) return;
        const meta = data?.meta || {};
        const update: any = {
          tags_rapidas: Array.isArray(meta.tags) ? meta.tags : [],
          tarefas: Array.isArray(meta.tasks) ? meta.tasks : [],
        };
        if (typeof meta.notes === "string") update.observacoes = meta.notes;
        const { error } = await supabase.from("compromissos").update(update).eq("id", id);
        if (error) throw error;
        sendToIframe({ type: "agenda:save-meta-result", ok: true, id });
      } catch (e: any) {
        console.error("[Agenda] erro ao salvar meta", e);
        sendToIframe({ type: "agenda:save-meta-result", ok: false, error: e?.message || "Erro ao salvar" });
      }
    }

    function onMessage(e: MessageEvent) {
      const d: any = e.data || {};
      if (d?.type === "agenda:ready") loadAndSend();
      if (d?.type === "agenda:create-agenda") createAgenda(d);
      if (d?.type === "agenda:update-agenda") updateAgenda(d);
      if (d?.type === "agenda:delete-agenda") deleteAgenda(d);
      if (d?.type === "agenda:save-compromisso") saveCompromisso(d);
      if (d?.type === "agenda:save-meta") saveCompromissoMeta(d);
    }


    const compromissosChannel = supabase
      .channel("agenda-page-compromissos")
      .on("postgres_changes", { event: "*", schema: "public", table: "compromissos" }, loadAndSend)
      .subscribe();
    const lembretesChannel = supabase
      .channel("agenda-page-lembretes")
      .on("postgres_changes", { event: "*", schema: "public", table: "lembretes" }, loadAndSend)
      .subscribe();
    const agendasChannel = supabase
      .channel("agenda-page-agendas")
      .on("postgres_changes", { event: "*", schema: "public", table: "agendas" }, loadAndSend)
      .subscribe();

    window.addEventListener("message", onMessage);
    const t = setTimeout(loadAndSend, 800);
    return () => {
      cancelled = true;
      window.removeEventListener("message", onMessage);
      supabase.removeChannel(compromissosChannel);
      supabase.removeChannel(lembretesChannel);
      supabase.removeChannel(agendasChannel);
      clearTimeout(t);
    };
  }, [iframeReady]);

  return (
    <div className="w-full h-[calc(100vh-7rem)] min-h-[640px] overflow-hidden rounded-lg border border-border bg-background">
      {iframeReady ? (
        <iframe
          key={iframeSrc}
          ref={iframeRef}
          src={iframeSrc}
          title="Agenda - GROW OS"
          className="w-full h-full border-0 block"
        />
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Carregando agenda...
        </div>
      )}
    </div>
  );
}

