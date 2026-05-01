import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().slice(0, 10);

    const stats = { audiencias: 0, prazos: 0, notificacoes: 0 };

    // ===== 1. Audiências D-7, D-3, D-1, hoje =====
    const horizonDate = new Date(today);
    horizonDate.setDate(horizonDate.getDate() + 7);

    const { data: processos } = await supabase
      .from("legal_processes")
      .select("id, company_id, numero_processo, data_audiencia, audiencia_local, audiencia_modalidade, responsavel_id, lead_id")
      .gte("data_audiencia", todayStr)
      .lte("data_audiencia", horizonDate.toISOString())
      .not("data_audiencia", "is", null);

    for (const p of processos || []) {
      stats.audiencias++;
      const audDate = new Date(p.data_audiencia!);
      audDate.setHours(0, 0, 0, 0);
      const dias = Math.round((audDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (![0, 1, 3, 7].includes(dias)) continue;

      // Buscar usuários da empresa para notificar
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("company_id", p.company_id);

      const userIds = p.responsavel_id
        ? [p.responsavel_id]
        : (roles || []).map((r: any) => r.user_id);

      const titulo =
        dias === 0 ? `🚨 Audiência HOJE — ${p.numero_processo || "processo"}`
        : dias === 1 ? `⚠️ Audiência AMANHÃ — ${p.numero_processo || "processo"}`
        : `📅 Audiência em ${dias} dias — ${p.numero_processo || "processo"}`;

      const mensagem = `${p.audiencia_modalidade || "Audiência"} marcada para ${audDate.toLocaleDateString("pt-BR")}${p.audiencia_local ? " em " + p.audiencia_local : ""}.`;

      for (const uid of userIds) {
        // Evitar duplicar (mesma referência_id + tipo no mesmo dia)
        const { data: jaExiste } = await supabase
          .from("notificacoes")
          .select("id")
          .eq("usuario_id", uid)
          .eq("referencia_id", p.id)
          .eq("tipo", `audiencia_d${dias}`)
          .gte("created_at", todayStr)
          .maybeSingle();

        if (jaExiste) continue;

        await supabase.from("notificacoes").insert({
          usuario_id: uid,
          company_id: p.company_id,
          tipo: `audiencia_d${dias}`,
          titulo,
          mensagem,
          referencia_id: p.id,
          referencia_tipo: "legal_process",
        });
        stats.notificacoes++;
      }
    }

    // ===== 2. Prazos processuais (mesma lógica D-7/3/1/0) =====
    const { data: prazos } = await supabase
      .from("legal_deadlines")
      .select("id, company_id, legal_process_id, descricao, tipo, data_limite, responsavel_id, alerta_d7, alerta_d3, alerta_d1")
      .eq("status", "pendente")
      .gte("data_limite", todayStr)
      .lte("data_limite", horizonDate.toISOString().slice(0, 10));

    for (const pz of prazos || []) {
      stats.prazos++;
      const limiteDate = new Date(pz.data_limite!);
      limiteDate.setHours(0, 0, 0, 0);
      const dias = Math.round((limiteDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (![0, 1, 3, 7].includes(dias)) continue;
      if (dias === 7 && !pz.alerta_d7) continue;
      if (dias === 3 && !pz.alerta_d3) continue;
      if (dias === 1 && !pz.alerta_d1) continue;

      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("company_id", pz.company_id);

      const userIds = pz.responsavel_id
        ? [pz.responsavel_id]
        : (roles || []).map((r: any) => r.user_id);

      const titulo =
        dias === 0 ? `🚨 Prazo VENCE HOJE — ${pz.tipo}`
        : dias === 1 ? `⚠️ Prazo vence AMANHÃ — ${pz.tipo}`
        : `⏰ Prazo em ${dias} dias — ${pz.tipo}`;

      for (const uid of userIds) {
        const { data: jaExiste } = await supabase
          .from("notificacoes")
          .select("id")
          .eq("usuario_id", uid)
          .eq("referencia_id", pz.id)
          .eq("tipo", `prazo_d${dias}`)
          .gte("created_at", todayStr)
          .maybeSingle();

        if (jaExiste) continue;

        await supabase.from("notificacoes").insert({
          usuario_id: uid,
          company_id: pz.company_id,
          tipo: `prazo_d${dias}`,
          titulo,
          mensagem: pz.descricao,
          referencia_id: pz.id,
          referencia_tipo: "legal_deadline",
        });
        stats.notificacoes++;
      }
    }

    // ===== 3. Marcar prazos vencidos como "perdido" =====
    const { error: vencError } = await supabase
      .from("legal_deadlines")
      .update({ status: "perdido" })
      .eq("status", "pendente")
      .lt("data_limite", todayStr);

    if (vencError) console.error("Erro ao marcar vencidos:", vencError);

    return new Response(JSON.stringify({ ok: true, stats }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[juridico-notificacoes-cron]", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
