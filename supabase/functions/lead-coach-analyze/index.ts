// Lead Coach: agente sênior em SDR / abordagem / comunicação / negociação / vendas.
// Análise consultiva enriquecida: scores, cadência estruturada, ações "não fechou",
// detecção de risco e injeção da base de conhecimento da empresa.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM = `Você é um Coach Sênior em SDR, abordagem comercial, comunicação consultiva, negociação e fechamento de vendas. Você atua como agente oculto dentro do CRM GrowOS: o vendedor NÃO vê suas mensagens em tempo real — você analisa o histórico já trocado com o contato e devolve uma análise crítica, prática e em pt-BR.

Regras:
- Seja direto, sem floreio, sem "como uma IA".
- Aponte ganhos e perdas reais com base APENAS no que está no histórico.
- Quando sugerir scripts/mensagens, escreva como se fossem para o vendedor copiar e enviar agora (tom humano, sem clichês como "tudo bem com você?").
- Nunca invente fatos do contato. Se algo é suposição, sinalize.
- Use a BASE DE CONHECIMENTO fornecida (se houver) para embasar scripts, cases e respostas a objeções.
- Use português do Brasil, tom profissional e empático.
- Scores (0-100) devem refletir o histórico real, não otimismo padrão.`;

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
          enum: ["primeiro_contato","qualificacao","apresentacao","proposta","negociacao","objecao","fechamento","pos_venda","frio_perdido"],
        },
        temperatura: { type: "string", enum: ["quente","morno","frio"] },
        pontos_fortes: { type: "array", items: { type: "string" } },
        erros_e_perdas: { type: "array", items: { type: "string" } },
        abordagem_ideal: { type: "string" },
        comunicacao_mais_assertiva: { type: "string" },
        objecoes_detectadas: { type: "array", items: { type: "string" } },
        proximos_passos: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 6 },
        mensagem_sugerida: { type: "string" },
        scripts_alternativos: {
          type: "array", items: { type: "string" },
          description: "1-3 variações curtas alternativas para a mensagem sugerida.",
        },
        risco_de_perda: { type: "integer", minimum: 0, maximum: 100 },
        score_engajamento: { type: "integer", minimum: 0, maximum: 100, description: "Quanto o contato se engaja (responde, faz perguntas, demonstra interesse)." },
        score_intencao: { type: "integer", minimum: 0, maximum: 100, description: "Intenção real de compra detectada na conversa." },
        score_fit: { type: "integer", minimum: 0, maximum: 100, description: "Fit do contato com o produto/serviço." },
        sinal_nao_fechou: { type: "boolean", description: "True se já há sinais claros de que o lead pode não fechar (objeções fortes, silêncio, adiamento)." },
        acoes_nao_fechou: {
          type: "array",
          description: "Ações recomendadas quando o lead esfria. Use IDs canônicos quando possível: tag-followup, tag-objecao, mover-funil, follow-d1, follow-d3, ligacao-socio, script-reativacao.",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              titulo: { type: "string" },
              descricao: { type: "string" },
              prioridade: { type: "string", enum: ["alta","media","baixa"] },
            },
            required: ["id","titulo"],
          },
        },
        cadencia: {
          type: "array",
          description: "Cadência de follow-up (até 6 passos) com prazos relativos.",
          items: {
            type: "object",
            properties: {
              passo: { type: "integer" },
              titulo: { type: "string" },
              descricao: { type: "string" },
              quando: { type: "string", description: "Ex.: 'Agora', 'D+1 09:00', 'D+3', 'D+7'." },
              tipo: { type: "string", enum: ["mensagem","followup","ligacao","reativacao"] },
            },
            required: ["passo","titulo","descricao","quando"],
          },
        },
        kb_usadas: { type: "array", items: { type: "string" }, description: "IDs dos itens da base de conhecimento que embasaram a resposta." },
      },
      required: [
        "resumo_interacao","estagio_percebido","temperatura",
        "pontos_fortes","erros_e_perdas",
        "abordagem_ideal","comunicacao_mais_assertiva",
        "proximos_passos","mensagem_sugerida","risco_de_perda",
        "score_engajamento","score_intencao","score_fit",
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
    const { lead_id, phone, company_id, lead_name, contact_name, knowledge_base } = body || {};
    if (!company_id || (!lead_id && !phone)) {
      return new Response(JSON.stringify({ error: "company_id e (lead_id ou phone) são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let telefone = (phone || "").replace(/[^0-9]/g, "");
    if (!telefone && lead_id) {
      const { data: lead } = await supabase.from("leads").select("phone, telefone").eq("id", lead_id).maybeSingle();
      telefone = String((lead as any)?.phone || (lead as any)?.telefone || "").replace(/[^0-9]/g, "");
    }

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

    let leadCtx = "";
    if (lead_id) {
      const { data: lead } = await supabase.from("leads")
        .select("name, value, status, source, notes, created_at")
        .eq("id", lead_id).maybeSingle();
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

    // Base de conhecimento (vem do front)
    let kbBlock = "";
    if (Array.isArray(knowledge_base) && knowledge_base.length > 0) {
      kbBlock = knowledge_base.slice(0, 30).map((k: any, i: number) => {
        const id = k.id || `kb_${i}`;
        const title = (k.title || "").toString().slice(0, 120);
        const excerpt = (k.excerpt || k.content || "").toString().slice(0, 600);
        const tags = Array.isArray(k.tags) ? k.tags.join(", ") : "";
        return `- [${id}] ${title}${tags ? ` (tags: ${tags})` : ""}\n  ${excerpt}`;
      }).join("\n");
    }

    const userContent = [
      "=== CONTEXTO DO LEAD ===",
      leadCtx || `Nome: ${lead_name || contact_name || "—"}`,
      "",
      kbBlock ? "=== BASE DE CONHECIMENTO DA EMPRESA ===" : "",
      kbBlock,
      kbBlock ? "" : "",
      `=== HISTÓRICO DE CONVERSA (${mensagens.length} mensagens) ===`,
      transcricao,
      "",
      "Gere a análise consultiva estruturada agora. Calcule scores (engajamento, intenção, fit, risco) com base no histórico. Monte a cadência ideal de follow-up e, se houver risco de não fechar, preencha acoes_nao_fechou. Cite em kb_usadas os IDs da base que embasaram seus scripts.",
    ].filter((l) => l !== "" || true).join("\n");

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
