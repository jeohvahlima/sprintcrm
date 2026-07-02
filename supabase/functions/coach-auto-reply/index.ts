import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function generateReply(system: string, userPrompt: string): Promise<string> {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (lovableKey) {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: Deno.env.get("LOVABLE_MODEL") || "google/gemini-2.5-flash",
        temperature: 0.7,
        max_tokens: 500,
        messages: [
          { role: "system", content: system },
          { role: "user", content: userPrompt },
        ],
      }),
    });
    if (resp.ok) {
      const data = await resp.json();
      const reply = String(data?.choices?.[0]?.message?.content || "").trim();
      if (reply) return reply.replace(/^Resposta:\s*/i, "");
    }
  }

  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!anthropicKey) {
    throw new Error("Nenhuma chave de IA configurada (LOVABLE_API_KEY ou ANTHROPIC_API_KEY).");
  }

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-4-20250514",
      max_tokens: 500,
      temperature: 0.7,
      system,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`IA indisponivel (${resp.status}): ${text.slice(0, 180)}`);
  }

  const data = await resp.json();
  const reply = (data.content || [])
    .filter((part: any) => part?.type === "text")
    .map((part: any) => part.text || "")
    .join("\n")
    .trim()
    .replace(/^Resposta:\s*/i, "");

  if (!reply) throw new Error("IA nao gerou resposta.");
  return reply;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { company_id, phone, lead_id, lead_name, contact_name, knowledge_base, etapa_funil } = body || {};

    if (!company_id || (!lead_id && !phone)) {
      return jsonResponse({ error: "company_id e (lead_id ou phone) sao obrigatorios" });
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

    const userPrompt = `Nome do lead: ${lead_name || contact_name || "cliente"}\nResponda agora a ultima mensagem do lead.`;
    const reply = await generateReply(system, userPrompt);

    return jsonResponse({ reply });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    console.error("[coach-auto-reply]", msg);
    return jsonResponse({ error: msg });
  }
});
