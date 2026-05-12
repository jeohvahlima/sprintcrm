// Pre-SDR: enriquece um contato (empresa) para prospecção cold call.
// Usa Lovable AI com tool calling estruturado e fallback local para não perder contatos em lote.

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

function firstDecisionMaker(value: any): string {
  const text = String(value || "").trim();
  if (!text) return "a confirmar";
  return text.split(/[,;|\n•]+/).map((p) => p.trim()).filter(Boolean)[0] || "a confirmar";
}

function fallbackBrief(empresa: any, produtos: any[] | undefined, motivo: string) {
  const nome = empresa.fantasia || empresa.razao || "empresa";
  const decisor = firstDecisionMaker(empresa.socios);
  const hasSite = Boolean(empresa.site);
  const hasSocios = decisor !== "a confirmar";
  const hasPhone = Boolean(empresa.telefone);
  const fit_score = Math.min(82, 42 + (hasSite ? 12 : 0) + (hasSocios ? 16 : 0) + (hasPhone ? 10 : 0) + (empresa.email ? 6 : 0));
  const oferta = Array.isArray(produtos) && produtos.length
    ? `Iniciar pela oferta ${produtos[0]?.nome || produtos[0]?.name || "principal"}, validando aderência na ligação.`
    : "Diagnóstico de estruturação comercial e implantação do sistema, validando maturidade e volume de prospecção.";
  return {
    empresa_resumo: `${nome} deve ser tratado como prospect B2B; confirme segmento, porte e momento comercial na abertura.`,
    site_resumo: hasSite ? `Site informado: ${empresa.site}. Confirmar posicionamento e serviços antes da abordagem.` : "Site não informado; confirmar presença digital e canais de aquisição na ligação.",
    porte_estimado: "a confirmar",
    decisor_provavel: decisor,
    cargo_decisor: hasSocios ? "sócio / diretor provável" : "a confirmar",
    outros_decisores: [],
    gatekeeper_esperado: "recepção, atendimento ou administrativo",
    melhor_horario_ligar: "09h às 11h ou 14h às 17h",
    gancho_abertura: `Olá, falo com ${decisor}? Vi a ${nome} e queria entender rapidamente como vocês estruturam hoje a captação e atendimento comercial de novos clientes.`,
    perguntas_qualificacao: [
      "Hoje vocês têm alguém dedicado à prospecção ou o atendimento fica com o time comercial/administrativo?",
      "Quais canais geram mais oportunidades: indicação, tráfego, WhatsApp, ligação ou redes sociais?",
      "Existe algum processo ou sistema para acompanhar contatos, retornos e propostas?",
      "Qual seria o principal gargalo comercial hoje: gerar leads, atender rápido, acompanhar propostas ou fechar?",
    ],
    dores_provaveis: ["perda de oportunidades por falta de follow-up", "baixa previsibilidade comercial", "atendimento descentralizado em telefone/WhatsApp"],
    objecoes_provaveis: ["já temos indicações suficientes", "não é prioridade agora", "já usamos planilha ou sistema simples"],
    oferta_recomendada: oferta,
    fit_score,
    prioridade: fit_score >= 70 ? "alta" : fit_score >= 55 ? "média" : "baixa",
    risco_descarte: hasPhone ? [] : ["telefone não informado na lista"],
    observacoes: `Gerado com fallback seguro porque a IA não retornou resposta completa (${motivo}). Não inventar dados; validar decisor e contexto na primeira ligação.`,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const { empresa, icp, segmento_vendedor, produtos } = body || {};
    if (!empresa || typeof empresa !== "object") {
      return new Response(JSON.stringify({ error: "empresa obrigatória" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ brief: fallbackBrief(empresa, produtos, "LOVABLE_API_KEY ausente"), fallback: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
          model: "google/gemini-3-flash-preview",
          temperature: 0.2,
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
        return new Response(JSON.stringify({ brief: fallbackBrief(empresa, produtos, "sem créditos no Lovable AI"), fallback: true, warning: "Sem créditos no Lovable AI; gerado briefing básico para não perder o contato." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
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
      return new Response(JSON.stringify({ brief: fallbackBrief(empresa, produtos, `AI Gateway ${resp?.status ?? "?"}`), fallback: true, warning: `IA instável após ${maxAttempts} tentativas; gerado briefing básico.` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) {
      return new Response(JSON.stringify({ brief: fallbackBrief(empresa, produtos, "resposta sem estrutura"), fallback: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    let brief: any;
    try {
      brief = JSON.parse(call.function.arguments);
    } catch (e) {
      return new Response(JSON.stringify({ brief: fallbackBrief(empresa, produtos, "JSON malformado"), fallback: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
