// Pre-SDR: enriquece um contato (empresa) para prospecção cold call.
// Usa Lovable AI Gateway (gemini-2.5-flash) com tool calling estruturado e busca na web (google_search_retrieval) quando disponível.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM = `Você é um Pré-SDR sênior B2B. Recebe os dados públicos de uma empresa (razão social, fantasia, telefone, site, sócios, segmento) e o ICP do vendedor. Faça uma PRÉ-ANÁLISE objetiva para abrir uma cold call com mais assertividade. Responda em pt-BR, prático, sem floreio. Se não souber algo com certeza, marque como "a confirmar" — nunca invente CNPJs, e-mails ou telefones.`;

const TOOL = {
  type: "function",
  function: {
    name: "pre_sdr_brief",
    description: "Briefing pré-call estruturado.",
    parameters: {
      type: "object",
      properties: {
        empresa_resumo: { type: "string", description: "1-2 linhas sobre o que a empresa faz." },
        site_resumo: { type: "string", description: "Resumo do que aparece no site (serviços, posicionamento)." },
        porte_estimado: { type: "string", enum: ["micro", "pequeno", "médio", "grande", "a confirmar"] },
        decisor_provavel: { type: "string", description: "Nome mais provável do decisor (sócio principal / CEO)." },
        cargo_decisor: { type: "string" },
        outros_decisores: { type: "array", items: { type: "string" } },
        gatekeeper_esperado: { type: "string", description: "Quem provavelmente atende o telefone (recepção, secretária, etc.)." },
        melhor_horario_ligar: { type: "string" },
        gancho_abertura: { type: "string", description: "Frase de abertura personalizada para essa empresa." },
        perguntas_qualificacao: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 6 },
        dores_provaveis: { type: "array", items: { type: "string" } },
        objecoes_provaveis: { type: "array", items: { type: "string" } },
        oferta_recomendada: { type: "string", description: "Qual produto/serviço do portfólio do vendedor casa melhor." },
        fit_score: { type: "integer", minimum: 0, maximum: 100, description: "Aderência da empresa ao ICP." },
        prioridade: { type: "string", enum: ["alta", "média", "baixa"] },
        risco_descarte: { type: "array", items: { type: "string" }, description: "Sinais que indicam não-fit." },
        observacoes: { type: "string" },
      },
      required: [
        "empresa_resumo", "porte_estimado", "decisor_provavel", "cargo_decisor",
        "melhor_horario_ligar", "gancho_abertura", "perguntas_qualificacao",
        "dores_provaveis", "objecoes_provaveis", "oferta_recomendada", "fit_score", "prioridade",
      ],
    },
  },
};

function fmtPhone(v: any): string {
  if (v == null) return "";
  let s = String(v).replace(/\D/g, "");
  if (!s) return String(v);
  if (s.length === 10 || s.length === 11) {
    const ddd = s.slice(0, 2);
    const rest = s.slice(2);
    const a = rest.slice(0, rest.length - 4);
    const b = rest.slice(-4);
    return `(${ddd}) ${a}-${b}`;
  }
  return s;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY ausente" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const body = await req.json().catch(() => ({}));
    const { empresa, icp, segmento_vendedor, produtos } = body || {};
    if (!empresa || typeof empresa !== "object") {
      return new Response(JSON.stringify({ error: "empresa obrigatória" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ctx: string[] = [];
    ctx.push("=== EMPRESA-ALVO ===");
    if (empresa.razao) ctx.push(`Razão social: ${empresa.razao}`);
    if (empresa.fantasia) ctx.push(`Nome fantasia: ${empresa.fantasia}`);
    if (empresa.cnpj) ctx.push(`CNPJ: ${empresa.cnpj}`);
    if (empresa.telefone) ctx.push(`Telefone: ${fmtPhone(empresa.telefone)}`);
    if (empresa.email) ctx.push(`E-mail: ${empresa.email}`);
    if (empresa.site) ctx.push(`Site: ${empresa.site}`);
    if (empresa.cidade) ctx.push(`Cidade/UF: ${empresa.cidade}`);
    if (empresa.socios) ctx.push(`Sócios listados: ${empresa.socios}`);
    if (empresa.observacoes) ctx.push(`Observações: ${empresa.observacoes}`);

    if (icp) {
      ctx.push("\n=== ICP DO VENDEDOR ===");
      ctx.push(typeof icp === "string" ? icp : JSON.stringify(icp).slice(0, 4000));
    }
    if (segmento_vendedor) ctx.push(`\nSegmento do vendedor: ${segmento_vendedor}`);
    if (Array.isArray(produtos) && produtos.length) {
      ctx.push("\nPortfólio do vendedor:");
      ctx.push(produtos.slice(0, 10).map((p: any) =>
        `- ${p.nome || p.name}${p.preco ? ` (R$ ${p.preco})` : ""}${p.descricao ? `: ${p.descricao}` : ""}`
      ).join("\n"));
    }
    ctx.push("\nGere o briefing estruturado para abrir uma cold call assertiva agora. Identifique o sócio mais provável como decisor (geralmente o primeiro listado ou o que tem cargo de direção). Para clínicas/consultórios médicos, o decisor costuma ser o médico-titular; o gatekeeper é a recepção.");

    // Retry com backoff exponencial para 429/5xx
    const maxAttempts = 4;
    let resp: Response | null = null;
    let lastErrText = "";
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: ctx.join("\n") },
          ],
          tools: [TOOL],
          tool_choice: { type: "function", function: { name: TOOL.function.name } },
        }),
      });
      if (resp.ok) break;
      lastErrText = await resp.text().catch(() => "");
      // 402 = sem créditos; não adianta tentar de novo
      if (resp.status === 402) {
        return new Response(JSON.stringify({ error: "Sem créditos no Lovable AI. Adicione créditos em Settings → Workspace → Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // 429 ou 5xx → espera e tenta de novo
      if (resp.status === 429 || resp.status >= 500) {
        const wait = Math.min(8000, 800 * Math.pow(2, attempt - 1)) + Math.floor(Math.random() * 400);
        console.warn(`[pre-sdr-analyze] tentativa ${attempt} falhou (${resp.status}), aguardando ${wait}ms`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      // Outros erros: retorna direto
      return new Response(JSON.stringify({ error: `AI Gateway ${resp.status}: ${lastErrText.slice(0, 300)}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!resp || !resp.ok) {
      const status = resp?.status === 429 ? 429 : 500;
      return new Response(JSON.stringify({ error: `AI Gateway ${resp?.status ?? "?"} após ${maxAttempts} tentativas: ${lastErrText.slice(0, 200)}` }), {
        status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) {
      return new Response(JSON.stringify({ error: "Sem tool_call na resposta" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    let brief: any;
    try {
      brief = JSON.parse(call.function.arguments);
    } catch (e) {
      return new Response(JSON.stringify({ error: "Resposta da IA inválida (JSON malformado)" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ brief }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    console.error("[pre-sdr-analyze]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
