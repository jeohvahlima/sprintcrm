// Lead Coach: agente sênior em SDR / abordagem / comunicação / negociação / vendas.
// Lê o histórico de conversas (WhatsApp/Instagram/etc.) com o contato, o lead vinculado e
// devolve uma análise consultiva: o que foi feito bem, onde se perdeu oportunidade,
// script sugerido, próximos passos e mensagem-modelo para retomada.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM = `Você é um Coach Sênior em SDR, abordagem comercial, comunicação consultiva, negociação e fechamento de vendas. Está atuando como um agente oculto dentro do CRM: o vendedor NÃO vê suas mensagens em tempo real — você analisa o histórico já trocado com o contato e devolve uma análise crítica, prática e em pt-BR.
Regras:
- Seja direto, sem floreio, sem "como uma IA".
- Aponte ganhos e perdas reais com base APENAS no que está no histórico.
- Se a conversa for curta ou só do contato, diga o que faltou fazer.
- Quando sugerir scripts/mensagens, escreva como se fossem para o vendedor copiar e enviar agora (tom humano, sem clichês como "tudo bem com você?").
- Nunca invente fatos do contato. Se algo é suposição, sinalize.
- Use português do Brasil, tom profissional e empático.`;

const TOOL = {
  type: "function",
  function: {
    name: "lead_coach_report",
    description: "Análise consultiva da conversa com o lead.",
    parameters: {
      type: "object",
      properties: {
        resumo_interacao: { type: "string", description: "1-3 linhas sobre o que aconteceu na conversa até aqui." },
        estagio_percebido: {
          type: "string",
          enum: ["primeiro_contato", "qualificacao", "apresentacao", "proposta", "negociacao", "objecao", "fechamento", "pos_venda", "frio_perdido"],
          description: "Onde o lead está hoje, segundo a conversa.",
        },
        temperatura: { type: "string", enum: ["quente", "morno", "frio"] },
        pontos_fortes: { type: "array", items: { type: "string" }, description: "O que o vendedor fez bem." },
        erros_e_perdas: { type: "array", items: { type: "string" }, description: "Onde se perdeu oportunidade ou se quebrou rapport." },
        abordagem_ideal: { type: "string", description: "Qual abordagem/script deveria ter sido usado, dado o perfil do contato." },
        comunicacao_mais_assertiva: { type: "string", description: "Como reescrever a comunicação para ser mais assertiva." },
        objecoes_detectadas: { type: "array", items: { type: "string" } },
        proximos_passos: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 6 },
        mensagem_sugerida: { type: "string", description: "Mensagem pronta para o vendedor enviar agora pelo mesmo canal." },
        risco_de_perda: { type: "integer", minimum: 0, maximum: 100, description: "Risco de o lead esfriar/ser perdido se nada for feito." },
      },
      required: [
        "resumo_interacao", "estagio_percebido", "temperatura",
        "pontos_fortes", "erros_e_perdas",
        "abordagem_ideal", "comunicacao_mais_assertiva",
        "proximos_passos", "mensagem_sugerida", "risco_de_perda",
      ],
    },
  },
};

function senderLabel(fromme: any) {
  return (fromme === true || fromme === "true") ? "VENDEDOR" : "CONTATO";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const { lead_id, phone, company_id, lead_name, contact_name } = body || {};
    if (!company_id || (!lead_id && !phone)) {
      return new Response(JSON.stringify({ error: "company_id e (lead_id ou phone) são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar telefone via lead se não veio
    let telefone = (phone || "").replace(/[^0-9]/g, "");
    if (!telefone && lead_id) {
      const { data: lead } = await supabase
        .from("leads")
        .select("phone, telefone")
        .eq("id", lead_id)
        .maybeSingle();
      telefone = String((lead as any)?.phone || (lead as any)?.telefone || "").replace(/[^0-9]/g, "");
    }

    // Buscar histórico de mensagens (até 120 últimas)
    let mensagens: any[] = [];
    if (telefone) {
      const { data } = await supabase
        .from("conversas")
        .select("mensagem, fromme, created_at, tipo_mensagem, nome_contato")
        .eq("company_id", company_id)
        .or(`telefone_formatado.eq.${telefone},numero.eq.${telefone}`)
        .order("created_at", { ascending: false })
        .range(0, 119);
      mensagens = (data || []).reverse();
    }

    // Dados extras do lead (contexto)
    let leadCtx = "";
    if (lead_id) {
      const { data: lead } = await supabase
        .from("leads")
        .select("name, value, status, source, notes, created_at")
        .eq("id", lead_id)
        .maybeSingle();
      if (lead) {
        leadCtx = [
          `Nome: ${(lead as any).name || lead_name || "—"}`,
          (lead as any).value ? `Valor: R$ ${(lead as any).value}` : "",
          (lead as any).status ? `Status atual: ${(lead as any).status}` : "",
          (lead as any).source ? `Origem: ${(lead as any).source}` : "",
          (lead as any).notes ? `Anotações: ${String((lead as any).notes).slice(0, 500)}` : "",
          (lead as any).created_at ? `Lead criado em: ${(lead as any).created_at}` : "",
        ].filter(Boolean).join("\n");
      }
    }

    const transcricao = mensagens.length
      ? mensagens.map((m) => {
          const quem = senderLabel(m.fromme);
          const tipo = m.tipo_mensagem && m.tipo_mensagem !== "text" ? ` [${m.tipo_mensagem}]` : "";
          const txt = (m.mensagem || "").toString().replace(/\s+/g, " ").trim().slice(0, 800);
          return `[${m.created_at}] ${quem}${tipo}: ${txt}`;
        }).join("\n")
      : "(Nenhuma mensagem registrada com este contato ainda.)";

    const userContent = [
      "=== CONTEXTO DO LEAD ===",
      leadCtx || `Nome: ${lead_name || contact_name || "—"}`,
      "",
      `=== HISTÓRICO DE CONVERSA (${mensagens.length} mensagens) ===`,
      transcricao,
      "",
      "Gere a análise consultiva estruturada agora. Foque em: o que foi feito, onde perdeu oportunidade, qual script/abordagem deveria ter sido usada com este perfil, comunicação mais assertiva, próximos passos e uma mensagem pronta para retomar AGORA.",
    ].join("\n");

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY ausente" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let resp: Response | null = null;
    let lastErr = "";
    for (let attempt = 1; attempt <= 3; attempt++) {
      resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          temperature: 0.3,
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: userContent },
          ],
          tools: [TOOL],
          tool_choice: { type: "function", function: { name: TOOL.function.name } },
        }),
      });
      if (resp.ok) break;
      lastErr = await resp.text().catch(() => "");
      if (resp.status === 402) {
        return new Response(JSON.stringify({ error: "Sem créditos no Lovable AI. Adicione créditos na workspace para usar o Coach." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (resp.status === 429 || resp.status >= 500) {
        await new Promise((r) => setTimeout(r, 700 * attempt));
        continue;
      }
      break;
    }

    if (!resp || !resp.ok) {
      return new Response(JSON.stringify({ error: `IA indisponível: ${resp?.status ?? "?"} ${lastErr.slice(0, 200)}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) {
      return new Response(JSON.stringify({ error: "IA não retornou análise estruturada." }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    let report: any;
    try { report = JSON.parse(call.function.arguments); }
    catch { return new Response(JSON.stringify({ error: "JSON malformado retornado pela IA." }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }

    return new Response(JSON.stringify({ report, total_mensagens: mensagens.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    console.error("[lead-coach-analyze]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
