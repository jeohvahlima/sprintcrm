// 🔒 LOCKED: Render the official GROW OS Contatos mockup inside the app layout.
// Visual changes must be made in public/contatos.html — do NOT replace with old React components.
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AniversariantesManager } from "@/components/leads/AniversariantesManager";

export default function Leads() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [anivOpen, setAnivOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    const send = (payload: any) => {
      iframeRef.current?.contentWindow?.postMessage(payload, "*");
    };

    const loadStats = async () => {
      try {
        // Total
        const { count: total } = await supabase
          .from("leads")
          .select("id", { count: "exact", head: true });

        // Ganhos / Perdidos via stage
        const { count: won } = await supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("stage", "ganho");

        const { count: lost } = await supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("stage", "perdido");

        // Soma de valor — pagina para evitar limite de 1000
        let value = 0;
        let from = 0;
        const pageSize = 1000;
        while (true) {
          const { data, error } = await supabase
            .from("leads")
            .select("value")
            .not("value", "is", null)
            .range(from, from + pageSize - 1);
          if (error || !data?.length) break;
          for (const row of data) value += Number((row as any).value) || 0;
          if (data.length < pageSize) break;
          from += pageSize;
        }

        if (!mounted) return;
        send({
          type: "contatos-stats",
          total: total || 0,
          won: won || 0,
          lost: lost || 0,
          value,
        });
      } catch (err) {
        console.error("[Leads stats]", err);
      }
    };

    const loadContacts = async () => {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (userError || !user?.id) {
          if (userError) console.error("[Leads contacts] auth error", userError);
          return;
        }

        const { data: userRole, error: roleError } = await supabase
          .from("user_roles")
          .select("company_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (roleError || !userRole?.company_id) {
          if (roleError) console.error("[Leads contacts] user role error", roleError);
          return;
        }

        const pageSize = 1000;
        let from = 0;
        let allLeads: any[] = [];

        while (true) {
          const { data, error } = await supabase
            .from("leads")
            .select(
              "id, name, email, phone, telefone, status, stage, source, value, tags, created_at"
            )
            .eq("company_id", userRole.company_id)
            .order("created_at", { ascending: false })
            .range(from, from + pageSize - 1);

          if (error) {
            console.error("[Leads contacts]", error);
            return;
          }

          if (!data?.length) break;
          allLeads = allLeads.concat(data);
          if (data.length < pageSize) break;
          from += pageSize;
        }

        if (!mounted) return;
        send({ type: "contatos-data", leads: allLeads });
      } catch (err) {
        console.error("[Leads contacts]", err);
      }
    };

    const createLead = async (lead: any) => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user?.id) throw new Error("Usuário não autenticado.");
        const { data: userRole } = await supabase
          .from("user_roles")
          .select("company_id")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!userRole?.company_id) throw new Error("Empresa não encontrada.");

        const { error } = await supabase.from("leads").insert({
          name: lead.name,
          phone: lead.phone,
          email: lead.email,
          source: lead.source || "manual",
          value: lead.value,
          notes: lead.notes,
          status: "novo",
          company_id: userRole.company_id,
        } as any);
        if (error) throw error;

        send({ type: "contatos-lead-created", ok: true });
        loadStats();
        loadContacts();
      } catch (err: any) {
        console.error("[Leads create]", err);
        send({
          type: "contatos-lead-created",
          ok: false,
          error: err?.message || "Erro ao salvar contato.",
        });
      }
    };

    const importLeads = async (leads: any[], tags: string[]) => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) throw new Error("Usuário não autenticado.");
        const { data: userRole } = await supabase
          .from("user_roles").select("company_id").eq("user_id", user.id).maybeSingle();
        if (!userRole?.company_id) throw new Error("Empresa não encontrada.");

        const existing = new Set<string>();
        let fromIdx = 0;
        while (true) {
          const { data, error } = await supabase
            .from("leads").select("phone, telefone")
            .eq("company_id", userRole.company_id)
            .range(fromIdx, fromIdx + 999);
          if (error || !data?.length) break;
          data.forEach((l: any) => {
            const p = String(l.phone || l.telefone || "").replace(/\D/g, "");
            if (p) existing.add(p);
          });
          if (data.length < 1000) break;
          fromIdx += 1000;
        }

        const toInsert: any[] = [];
        let duplicates = 0;
        for (const l of leads) {
          const p = String(l.phone || "").replace(/\D/g, "");
          if (p && existing.has(p)) { duplicates++; continue; }
          if (p) existing.add(p);
          toInsert.push({
            name: l.name || (p ? `Contato ${p.slice(-4)}` : "Contato"),
            phone: p ? `+${p}` : null,
            telefone: p ? `+${p}` : null,
            email: l.email || null,
            source: "import",
            status: "novo",
            stage: "prospeccao",
            value: 0,
            company_id: userRole.company_id,
            owner_id: user.id,
            ...(tags.length ? { tags } : {}),
          });
        }

        let success = 0;
        for (let i = 0; i < toInsert.length; i += 500) {
          const batch = toInsert.slice(i, i + 500);
          const { error } = await supabase.from("leads").insert(batch as any);
          if (error) throw error;
          success += batch.length;
        }
        send({ type: "contatos-import-result", ok: true, success, duplicates });
        loadStats(); loadContacts();
      } catch (err: any) {
        console.error("[Leads import]", err);
        send({ type: "contatos-import-result", ok: false, error: err?.message || "Erro ao importar." });
      }
    };

    const onMessage = (ev: MessageEvent) => {
      if (ev.data?.type === "contatos-ready") {
        loadStats();
        loadContacts();
      }
      if (ev.data?.type === "contatos-create-lead") {
        createLead(ev.data.lead);
      }
      if (ev.data?.type === "contatos-import-leads") {
        importLeads(ev.data.leads || [], ev.data.tags || []);
      }
      if (ev.data?.type === "contatos-open-aniversariantes") {
        setAnivOpen(true);
      }
    };
    window.addEventListener("message", onMessage);

    // Carrega imediatamente e quando o iframe terminar de montar
    loadStats();
    loadContacts();
    const iframe = iframeRef.current;
    const onIframeLoad = () => {
      loadStats();
      loadContacts();
    };
    iframe?.addEventListener("load", onIframeLoad);

    // Realtime: qualquer mudança em leads recarrega as contagens e contatos
    const ch = supabase
      .channel("leads_stats_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leads" },
        () => {
          loadStats();
          loadContacts();
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      window.removeEventListener("message", onMessage);
      iframe?.removeEventListener("load", onIframeLoad);
      supabase.removeChannel(ch);
    };
  }, []);

  return (
    <div className="w-full h-[calc(100vh-7rem)] min-h-[640px] overflow-hidden rounded-lg border border-border bg-background">
      <iframe
        ref={iframeRef}
        src="/contatos.html"
        title="Contatos do CRM"
        className="w-full h-full border-0 block"
      />
      <Dialog open={anivOpen} onOpenChange={setAnivOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Aniversariantes</DialogTitle>
          </DialogHeader>
          <AniversariantesManager />
        </DialogContent>
      </Dialog>
    </div>
  );
}
