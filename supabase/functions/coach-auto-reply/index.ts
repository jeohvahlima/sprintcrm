import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { company_id, phone, lead_id, lead_name, contact_name, knowledge_base, etapa_funil } = body || {};

    if (!company_id || (!lead_id && !phone)) {
      return new Response(JSON.stringify({ error: "company_id e (lead_id ou phone) sao obrigatorios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let telefone = String(phone || "").replace(/[^0-9]/g, "");
    if (!telefone && lead_id) {
      const { data: lead } = await supabase.from("leads").select("phone, telefone").eq("id", lead_id).maybeSingle();
      telefone = String((lead as any)?.phone || (lead as any)?.telefone || "").replace(/[^0-9]/g, "");
    }

    let mensagens: any[] = [];
    if (telefone) {
      const { data } = await supabase
        .from("conversas")
        .select("mensagem, fromme, created_at, tipo_mensagem")
        .eq("company_id", company_id)
        .or(`telefone_formatado.eq.${telefone},numero.eq.${telefone}`)
        .order("created_at", { ascending: false })
        .range(0, 59);
      mensagens = (data || []).reverse();
    }

    const historico = mensagens.map((m) => {
      const quem = m.fromme === true || m.fromme === "true" ? "VENDEDOR" : "LEAD";
      return `${quem}: ${String(m.mensagem || "").replace(/\s+/g, " ").trim().slice(0, 700)}`;
    }).join("\n");

    const baseConhecimento = Array.isArray(knowledge_base)
      ? knowledge_base.slice(0, 30).map((k: any) => {
        const id = k.id ? `[${k.id}] ` : "";
        return `- ${id}${k.title || "Sem titulo"}: ${String(k.excerpt || k.content || "").slice(0, 600)}`;
      }).join("\n")
      : "";

    const system = `Voce e um vendedor especialista da empresa GrowSOS respondendo via WhatsApp.
Use a base de conhecimento fornecida. Seja natural, humano, direto e persuasivo.
Responda APENAS com a mensagem para o lead, sem explicacoes adicionais.
Maximo 3 paragrafos curtos. Use emojis com moderacao.

Base de conhecimento: ${baseConhecimento || "(sem base cadastrada)"}
Etapa do funil: ${etapa_funil || "-"}
Historico: ${historico || "(sem historico)"}`;

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY ausente" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-4-6",
        max_tokens: 500,
        temperature: 0.7,
        system,
        messages: [{
          role: "user",
          content: `Nome do lead: ${lead_name || contact_name || "cliente"}\nResponda agora a ultima mensagem do lead.`,
        }],
      }),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return new Response(JSON.stringify({ error: `Claude indisponivel: ${resp.status} ${text.slice(0, 180)}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const reply = (data.content || [])
      .filter((part: any) => part?.type === "text")
      .map((part: any) => part.text || "")
      .join("\n")
      .trim()
      .replace(/^Resposta:\s*/i, "");

    if (!reply) {
      return new Response(JSON.stringify({ error: "Claude nao gerou resposta." }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
