import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization") || "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );

    // Identifica usuário e empresa
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: "unauthenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: roleRow } = await admin
      .from("user_roles")
      .select("company_id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    const companyId = roleRow?.company_id;
    if (!companyId) {
      return new Response(JSON.stringify({ error: "no_company" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) Criar funil (idempotente via RPC)
    const { data: funilId, error: rpcErr } = await admin.rpc("create_social_selling_funnel", {
      p_company_id: companyId,
    });
    if (rpcErr) throw rpcErr;

    // 2) Migrar leads do Instagram para o funil (sem etapa, status novo)
    const { data: stageNovo } = await admin
      .from("etapas")
      .select("id")
      .eq("funil_id", funilId)
      .eq("nome", "Novo Seguidor")
      .maybeSingle();

    let migratedLeads = 0;
    if (stageNovo?.id) {
      const { count } = await admin
        .from("leads")
        .update({ funil_id: funilId, etapa_id: stageNovo.id }, { count: "exact" })
        .eq("company_id", companyId)
        .eq("lead_source_type", "instagram")
        .is("funil_id", null);
      migratedLeads = count || 0;
    }

    // 3) Seed playbooks (idempotente por título)
    const playbooks = [
      {
        title: "Script DM Fria — Social Selling",
        description: "Abertura leve e personalizada para iniciar conversa com seguidor",
        category: "social-selling",
        cover_emoji: "💬",
        accent_color: "#22C55E",
        sections: [
          {
            title: "Abertura",
            content:
              "Oi {{nome}}! Vi seu perfil e curti muito {{motivo_personalizado}}. Posso te fazer uma pergunta rápida?",
          },
          {
            title: "Quebra de gelo",
            content:
              "Trabalho com {{seu_serviço}} ajudando pessoas como você a {{benefício}}. Faz sentido pra você hoje?",
          },
        ],
      },
      {
        title: "Script Resposta de Story",
        description: "Como aproveitar quando o lead responde um story",
        category: "social-selling",
        cover_emoji: "📸",
        accent_color: "#A855F7",
        sections: [
          {
            title: "Resposta inicial",
            content:
              "Que bom que curtiu, {{nome}}! 😊 Esse conteúdo foi pensando em quem {{contexto}}. Me conta: o que mais te chamou atenção?",
          },
          { title: "Transição", content: "Posso te mandar um material que aprofunda esse ponto?" },
        ],
      },
      {
        title: "Script Quebra de Objeção",
        description: "Respostas para 'tá caro', 'vou pensar', 'não tenho tempo'",
        category: "social-selling",
        cover_emoji: "🛡️",
        accent_color: "#F59E0B",
        sections: [
          {
            title: "Tá caro",
            content:
              "Entendo, {{nome}}. Caro comparado ao quê? Costumo dizer que o caro mesmo é continuar perdendo {{dor_principal}}. Posso te mostrar o ROI rápido?",
          },
          {
            title: "Vou pensar",
            content:
              "Faz sentido pensar! Só pra eu te ajudar melhor: o que ainda falta de informação pra você decidir hoje?",
          },
        ],
      },
      {
        title: "Script Convite para Reunião",
        description: "Convite direto e baixo atrito após qualificação",
        category: "social-selling",
        cover_emoji: "📅",
        accent_color: "#0EA5E9",
        sections: [
          {
            title: "Convite",
            content:
              "{{nome}}, pelo que conversamos faz total sentido marcarmos 20 min pra eu te mostrar como podemos {{benefício}}. Tenho terça 14h ou quarta 10h — qual fica melhor?",
          },
        ],
      },
    ];

    let createdPlaybooks = 0;
    for (const pb of playbooks) {
      const { data: existing } = await admin
        .from("commercial_playbooks")
        .select("id")
        .eq("company_id", companyId)
        .eq("title", pb.title)
        .maybeSingle();
      if (!existing) {
        await admin.from("commercial_playbooks").insert({
          company_id: companyId,
          title: pb.title,
          description: pb.description,
          category: pb.category,
          cover_emoji: pb.cover_emoji,
          accent_color: pb.accent_color,
          sections: pb.sections,
          tags: ["social-selling", "instagram"],
          difficulty: "iniciante",
          estimated_time: "5 min",
          created_by: userId,
        });
        createdPlaybooks++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        funil_id: funilId,
        migrated_leads: migratedLeads,
        playbooks_created: createdPlaybooks,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("social-selling-bootstrap error", err);
    return new Response(JSON.stringify({ error: err.message ?? String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
