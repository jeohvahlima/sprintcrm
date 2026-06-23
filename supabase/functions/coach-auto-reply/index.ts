// Coach Auto-Reply: quando o Modo Autônomo está ativo, gera a melhor resposta
// para enviar ao lead via WhatsApp, usando histórico + base de conhecimento.
// Retorna apenas o texto da resposta, sem explicações.

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
      return new Response(JSON.stringify({ error: "company_id e (lead_id ou phone) são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    let telefone = (phone || "").replace(/[^0-9]/g, "");
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
        .range(0, 39);
      mensagens = (data || []).reverse();
    }

    const transcricao = mensagens.map(m => {
      const quem = (m.fromme === true || m.fromme === "true") ? "VENDEDOR" : "CONTATO";
      return `${quem}: ${(m.mensagem || "").toString().slice(0, 500)}`;
    }).join("\n");

    let kbBlock = "";
    if (Array.isArray(knowledge_base) && knowledge_base.length > 0) {
      kbBlock = knowledge_base.slice(0, 20).map((k: any) => `- ${k.title}: ${(k.excerpt || k.content || "").slice(0, 400)}`).join("\n");
    }

    const system = `Você é um vendedor especialista da empresa GrowOS respondendo via WhatsApp.
Use a base de conhecimento fornecida. Seja natural, humano, direto e persuasivo.
Responda APENAS com a mensagem para o lead, sem explicações, sem prefixos como "Resposta:".
Máximo 3 parágrafos curtos. Use emojis com moderação.
Nome do contato: ${lead_name || contact_name || "cliente"}.
Etapa do funil: ${etapa_funil || "—"}.`;

    const userMsg = [
      kbBlock ? "BASE DE CONHECIMENTO:\n" + kbBlock + "\n" : "",
      "HISTÓRICO RECENTE:\n" + (transcricao || "(sem histórico)"),
      "\nResponda agora à última mensagem do CONTATO de forma natural.",
    ].join("\n");

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY ausente" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        temperature: 0.7,
        messages: [
          { role: "system", content: system },
          { role: "user", content: userMsg },
        ],
      }),
    });

    if (!resp.ok) {
      if (resp.status === 402) return new Response(JSON.stringify({ error: "Sem créditos no Lovable AI." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await resp.text().catch(() => "");
      return new Response(JSON.stringify({ error: `IA indisponível: ${resp.status} ${t.slice(0, 150)}` }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await resp.json();
    const reply = (data.choices?.[0]?.message?.content || "").toString().trim();
    if (!reply) {
      return new Response(JSON.stringify({ error: "IA não gerou resposta." }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
