import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM = `Voce e o Coach IA de vendas do CRM GrowSOS.
Analise a conversa com o lead e retorne APENAS um JSON valido, sem markdown, sem texto antes ou depois.
Use a base de conhecimento fornecida para embasar scripts, cases e respostas a objecoes.
Nao invente fatos. Se algo for inferencia, sinalize no texto.

Formato obrigatorio:
{
  "situacao": ["lista de situacoes detectadas com emoji"],
  "risco": 72,
  "script": "script ideal para responder agora",
  "scripts_alternativos": ["script 2", "script 3"],
  "proximos_passos": ["passo 1", "passo 2", "passo 3", "passo 4"],
  "resumo": "resumo da conversa em 2 frases",
  "o_que_foi_bem": ["item 1", "item 2"],
  "onde_perdeu": ["item 1", "item 2"],
  "objecoes": ["objecao 1", "objecao 2"],
  "engajamento": 0,
  "intencao": 0,
  "fit": 0,
  "temperatura": "quente|morno|frio",
  "estagio": "primeiro_contato|qualificacao|apresentacao|proposta|negociacao|objecao|fechamento|pos_venda|frio_perdido",
  "cadencia": [
    {"passo": 1, "titulo": "...", "descricao": "...", "quando": "...", "status": "done|active|pending", "tipo": "mensagem|followup|ligacao|reativacao"}
  ],
  "acoes_nao_fechou": [
    {"tipo": "tag|funil|follow|ligacao|script", "id": "tag-followup|tag-objecao|mover-funil|follow-d1|follow-d3|ligacao-socio|script-reativacao", "titulo": "...", "descricao": "...", "valor": "...", "prioridade": "alta|media|baixa"}
  ],
  "kb_usadas": ["id-do-card"]
}`;

function senderLabel(fromme: unknown) {
  return fromme === true || fromme === "true" ? "VENDEDOR" : "CONTATO";
}

function clampScore(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function extractJson(text: string) {
  const clean = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(clean);
  } catch {
    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(clean.slice(start, end + 1));
    throw new Error("Claude nao retornou JSON valido.");
  }
}

function normalizeReport(raw: any) {
  const risco = clampScore(raw?.risco ?? raw?.risco_de_perda);
  const situacao = Array.isArray(raw?.situacao) ? raw.situacao : [];
  const pontosFortes = Array.isArray(raw?.o_que_foi_bem) ? raw.o_que_foi_bem : raw?.pontos_fortes || [];
  const errosPerdas = Array.isArray(raw?.onde_perdeu) ? raw.onde_perdeu : raw?.erros_e_perdas || [];
  const objecoes = Array.isArray(raw?.objecoes) ? raw.objecoes : raw?.objecoes_detectadas || [];
  const temperatura = ["quente", "morno", "frio"].includes(raw?.temperatura)
    ? raw.temperatura
    : risco > 60 ? "frio" : risco >= 30 ? "morno" : "quente";

  return {
    situacao,
    resumo_interacao: raw?.resumo || raw?.resumo_interacao || "Sem resumo retornado pela IA.",
    estagio_percebido: raw?.estagio || raw?.estagio_percebido || "qualificacao",
    temperatura,
    pontos_fortes: pontosFortes,
    erros_e_perdas: errosPerdas,
    abordagem_ideal: raw?.script || raw?.abordagem_ideal || "",
    comunicacao_mais_assertiva: raw?.script || raw?.comunicacao_mais_assertiva || "",
    objecoes_detectadas: objecoes,
    proximos_passos: Array.isArray(raw?.proximos_passos) ? raw.proximos_passos : [],
    mensagem_sugerida: raw?.script || raw?.mensagem_sugerida || "",
    scripts_alternativos: Array.isArray(raw?.scripts_alternativos) ? raw.scripts_alternativos : [],
    risco_de_perda: risco,
    score_engajamento: clampScore(raw?.engajamento ?? raw?.score_engajamento),
    score_intencao: clampScore(raw?.intencao ?? raw?.score_intencao),
    score_fit: clampScore(raw?.fit ?? raw?.score_fit),
    sinal_nao_fechou: Boolean(
      raw?.sinal_nao_fechou ||
      risco >= 60 ||
      objecoes.length > 0 ||
      (raw?.acoes_nao_fechou || []).length > 0
    ),
    acoes_nao_fechou: Array.isArray(raw?.acoes_nao_fechou) ? raw.acoes_nao_fechou : [],
    cadencia: Array.isArray(raw?.cadencia) ? raw.cadencia : [],
    kb_usadas: Array.isArray(raw?.kb_usadas) ? raw.kb_usadas : [],
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { lead_id, phone, company_id, lead_name, contact_name, knowledge_base } = body || {};

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
        .select("mensagem, fromme, created_at, tipo_mensagem, nome_contato")
        .eq("company_id", company_id)
        .or(`telefone_formatado.eq.${telefone},numero.eq.${telefone}`)
        .order("created_at", { ascending: false })
        .range(0, 119);
      mensagens = (data || []).reverse();
    }

    let leadCtx = "";
    if (lead_id) {
      const { data: lead } = await supabase
        .from("leads")
        .select("name, value, status, source, notes, created_at, last_lead_reply_at, follow_step")
        .eq("id", lead_id)
        .maybeSingle();

      if (lead) {
        leadCtx = [
          `Nome: ${(lead as any).name || lead_name || "-"}`,
          (lead as any).value ? `Valor: R$ ${(lead as any).value}` : "",
          (lead as any).status ? `Status atual: ${(lead as any).status}` : "",
          (lead as any).source ? `Origem: ${(lead as any).source}` : "",
          (lead as any).notes ? `Anotacoes: ${String((lead as any).notes).slice(0, 500)}` : "",
          (lead as any).created_at ? `Lead criado em: ${(lead as any).created_at}` : "",
          (lead as any).last_lead_reply_at
            ? `Ultima resposta do lead: ${(lead as any).last_lead_reply_at}`
            : "Lead nunca respondeu.",
          (lead as any).follow_step != null
            ? `Step atual da cadencia: ${[0, 1, 3, 7, 14][(lead as any).follow_step] != null ? "D+" + [0, 1, 3, 7, 14][(lead as any).follow_step] : "completo"}`
            : "",
        ].filter(Boolean).join("\n");
      }
    }

    const transcricao = mensagens.length
      ? mensagens.map((m) => {
        const quem = senderLabel(m.fromme);
        const tipo = m.tipo_mensagem && m.tipo_mensagem !== "text" ? ` [${m.tipo_mensagem}]` : "";
        const txt = String(m.mensagem || "").replace(/\s+/g, " ").trim().slice(0, 800);
        return `[${m.created_at}] ${quem}${tipo}: ${txt}`;
      }).join("\n")
      : "(Nenhuma mensagem registrada com este contato ainda.)";

    const kbBlock = Array.isArray(knowledge_base)
      ? knowledge_base.slice(0, 30).map((k: any, i: number) => {
        const id = k.id || `kb_${i}`;
        const title = String(k.title || "").slice(0, 120);
        const excerpt = String(k.excerpt || k.content || "").slice(0, 600);
        const tags = Array.isArray(k.tags) ? k.tags.join(", ") : "";
        return `- [${id}] ${title}${tags ? ` (tags: ${tags})` : ""}\n  ${excerpt}`;
      }).join("\n")
      : "";

    const userContent = [
      "Historico da conversa:",
      transcricao,
      "",
      `Dados do lead: ${leadCtx || `Nome: ${lead_name || contact_name || "-"}`}`,
      "",
      "Base de conhecimento:",
      kbBlock || "(sem base cadastrada)",
      "",
      "Detecte tambem estes padroes de risco: vou pensar, deixa eu ver, preciso falar com, esta muito caro, nao tenho budget, vou retornar, silencio apos proposta e objecao repetida.",
    ].join("\n");

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY ausente" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let resp: Response | null = null;
    let lastErr = "";
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-4-6",
          max_tokens: 1000,
          temperature: 0.2,
          system: SYSTEM,
          messages: [{ role: "user", content: userContent }],
        }),
      });

      if (resp.ok) break;
      lastErr = await resp.text().catch(() => "");
      if (resp.status === 429 || resp.status >= 500) {
        await new Promise((resolve) => setTimeout(resolve, 700 * attempt));
        continue;
      }
      break;
    }

    if (!resp || !resp.ok) {
      return new Response(JSON.stringify({ error: `Claude indisponivel: ${resp?.status ?? "?"} ${lastErr.slice(0, 200)}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const text = (data.content || [])
      .filter((part: any) => part?.type === "text")
      .map((part: any) => part.text || "")
      .join("\n")
      .trim();

    if (!text) {
      return new Response(JSON.stringify({ error: "Claude nao retornou analise estruturada." }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let report: any;
    try {
      report = normalizeReport(extractJson(text));
    } catch (e) {
      return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "JSON malformado retornado pela IA." }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ report, total_mensagens: mensagens.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    console.error("[lead-coach-analyze]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
