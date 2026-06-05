// 🔒 LOCKED: Render the official GROW OS Contatos mockup inside the app layout.
// Visual changes must be made in public/contatos.html — do NOT replace with old React components.
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function Leads() {
  const iframeRef = useRef<HTMLIFrameElement>(null);

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

    const onMessage = (ev: MessageEvent) => {
      if (ev.data?.type === "contatos-ready") loadStats();
    };
    window.addEventListener("message", onMessage);

    // Carrega imediatamente e quando o iframe terminar de montar
    loadStats();
    const iframe = iframeRef.current;
    iframe?.addEventListener("load", loadStats);

    // Realtime: qualquer mudança em leads recarrega as contagens
    const ch = supabase
      .channel("leads_stats_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leads" },
        () => loadStats()
      )
      .subscribe();

    return () => {
      mounted = false;
      window.removeEventListener("message", onMessage);
      iframe?.removeEventListener("load", loadStats);
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
    </div>
  );
}
