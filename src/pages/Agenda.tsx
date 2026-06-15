// 🔒 LOCKED: Render the official GROW OS Agenda mockup inside the app layout.
// Visual changes must be made in public/agenda.html — do NOT replace with old React components.
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function Agenda() {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAndSend() {
      const [{ data: agendas }, { data: profs }, { data: leads }] = await Promise.all([
        supabase.from("agendas").select("id, nome").order("nome"),
        supabase.from("profissionais").select("id, nome, especialidade").order("nome"),
        supabase
          .from("leads")
          .select("id, name, phone, email")
          .order("name")
          .range(0, 999),
      ]);
      if (cancelled) return;
      const payload = {
        type: "agenda:data",
        agendas: (agendas || []).map((a: any) => ({ id: a.id, label: a.nome })),
        profissionais: (profs || []).map((p: any) => ({
          id: p.id,
          label: p.especialidade ? `${p.nome} — ${p.especialidade}` : p.nome,
        })),
        leads: (leads || []).map((l: any) => ({
          id: l.id,
          name: l.name || "",
          phone: l.phone || "",
          email: l.email || "",
        })),
      };
      iframeRef.current?.contentWindow?.postMessage(payload, "*");
    }

    async function createAgenda(data: any) {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const user = userData?.user;
        if (!user) throw new Error("Usuário não autenticado");
        const { data: role } = await supabase
          .from("user_roles")
          .select("company_id")
          .eq("user_id", user.id)
          .maybeSingle();
        const company_id = role?.company_id;
        if (!company_id) throw new Error("Empresa não encontrada");

        const { error } = await supabase.from("agendas").insert({
          nome: data.nome,
          tipo: data.tipo || "colaborador",
          tempo_medio_servico: data.tempo_medio_servico || 30,
          capacidade_simultanea: data.capacidade_simultanea || 1,
          owner_id: user.id,
          company_id,
          status: "ativo",
        });
        if (error) throw error;

        iframeRef.current?.contentWindow?.postMessage(
          { type: "agenda:create-agenda-result", ok: true },
          "*"
        );
        await loadAndSend();
      } catch (e: any) {
        iframeRef.current?.contentWindow?.postMessage(
          { type: "agenda:create-agenda-result", ok: false, error: e?.message || "Erro" },
          "*"
        );
      }
    }

    function onMessage(e: MessageEvent) {
      const d: any = e.data || {};
      if (d?.type === "agenda:ready") loadAndSend();
      if (d?.type === "agenda:create-agenda") createAgenda(d);
    }
    window.addEventListener("message", onMessage);
    // tenta também após load do iframe
    const t = setTimeout(loadAndSend, 800);
    return () => {
      cancelled = true;
      window.removeEventListener("message", onMessage);
      clearTimeout(t);
    };
  }, []);

  return (
    <div className="w-full h-[calc(100vh-7rem)] min-h-[640px] overflow-hidden rounded-lg border border-border bg-background">
      <iframe
        ref={iframeRef}
        src="/agenda.html"
        title="Agenda — GROW OS"
        className="w-full h-full border-0 block"
      />
    </div>
  );
}
