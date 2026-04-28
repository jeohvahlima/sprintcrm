const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM = `Você é um estrategista comercial sênior, especialista em ICP (Ideal Customer Profile), comportamento de compra B2B/B2C, prospecção multicanal (cold call, social selling, WhatsApp, LinkedIn, e-mail), revenue operations e construção de máquinas de venda agressivas.

Sua missão: dado um NICHO e (quando informado) o SEGMENTO/PRODUTOS/SERVIÇOS DA EMPRESA QUE VENDE, gerar um diagnóstico estratégico COMPLETO em português do Brasil, com:
- Perfil firmográfico/demográfico realista para o mercado BR
- Comportamento de compra (gatilhos, padrão de consumo, jornada, ciclo, sazonalidade)
- Dores explícitas, latentes e gargalos operacionais
- Desejos, motivadores emocionais e racionais que LEVAM ESSE PÚBLICO A COMPRAR
- Crenças limitantes, tentativas frustradas e objeções reais
- Mapa de decisão (decisor, influenciador, bloqueador, horários, canais)
- ESTRATÉGIA DE ABORDAGEM POR CANAL (cold call, social selling, WhatsApp, LinkedIn, e-mail) com qual usar primeiro, mensagem-chave e quando escalar
- PLANO DE AÇÃO PRÁTICO (cadência multicanal, scripts iniciais, sequência SDR dia-a-dia)
- Critérios e pesos de Lead Score aplicáveis ao CRM (somando 100)
- Casamento explícito entre o que esse ICP precisa e os PRODUTOS/SERVIÇOS da empresa (se informados): qual oferta puxar primeiro, ângulo de pitch, prova social ideal

Seja ESPECÍFICO, prático, com números realistas, scripts reais, sem generalidades. Pense como Aaron Ross + Thiago Reis + Diego Wagner.`;

const TOOL = {
  type: "function",
  function: {
    name: "generate_icp_intelligence",
    description: "Gera o pacote completo de inteligência estratégica para um ICP a partir do nicho e contexto do produto.",
    parameters: {
      type: "object",
      properties: {
        profile: {
          type: "object",
          properties: {
            segmento: { type: "string" },
            subnichos: { type: "array", items: { type: "string" } },
            faturamento_mensal: { type: "string" },
            funcionarios: { type: "string" },
            estrutura_comercial: { type: "string" },
            ticket_medio_estimado: { type: "string" },
            ltv_estimado: { type: "string" },
            maturidade_comercial: { type: "string", enum: ["baixa", "média", "alta"] },
          },
          required: ["segmento", "subnichos", "faturamento_mensal", "funcionarios", "estrutura_comercial", "ticket_medio_estimado", "ltv_estimado", "maturidade_comercial"],
        },
        buying_behavior: {
          type: "object",
          description: "Como esse público compra, padrão de consumo, gatilhos e ciclo",
          properties: {
            gatilhos_compra: { type: "array", items: { type: "string" } },
            padrao_consumo: { type: "string", description: "Frequência, recorrência, ticket típico, sazonalidade" },
            jornada_decisao: { type: "array", items: { type: "string" }, description: "Etapas que esse público percorre antes de comprar" },
            ciclo_medio_dias: { type: "string" },
            momento_ideal_abordagem: { type: "string" },
            sinais_de_intencao: { type: "array", items: { type: "string" } },
          },
          required: ["gatilhos_compra", "padrao_consumo", "jornada_decisao", "ciclo_medio_dias", "momento_ideal_abordagem", "sinais_de_intencao"],
        },
        pains: {
          type: "object",
          properties: {
            explicitas: { type: "array", items: { type: "string" } },
            latentes: { type: "array", items: { type: "string" } },
            gargalos: { type: "array", items: { type: "string" } },
          },
          required: ["explicitas", "latentes", "gargalos"],
        },
        desires: { type: "array", items: { type: "string" } },
        beliefs: {
          type: "object",
          properties: {
            tentativas_frustradas: { type: "array", items: { type: "string" } },
            objecoes: { type: "array", items: { type: "string" } },
            motivos_falha: { type: "array", items: { type: "string" } },
          },
          required: ["tentativas_frustradas", "objecoes", "motivos_falha"],
        },
        decision_map: {
          type: "object",
          properties: {
            decisores: { type: "array", items: { type: "string" } },
            influenciadores: { type: "array", items: { type: "string" } },
            bloqueadores: { type: "array", items: { type: "string" } },
            abordagens: { type: "array", items: { type: "string" } },
            melhores_horarios: { type: "array", items: { type: "string" } },
            objecoes_comuns: { type: "array", items: { type: "string" } },
            canais_recomendados: { type: "array", items: { type: "string" } },
          },
          required: ["decisores", "influenciadores", "bloqueadores", "abordagens", "melhores_horarios", "objecoes_comuns", "canais_recomendados"],
        },
        channel_strategy: {
          type: "object",
          description: "Como abordar esse público por canal",
          properties: {
            cold_call: { type: "object", properties: { quando_usar: { type: "string" }, abertura: { type: "string" }, eficacia: { type: "string", enum: ["baixa", "média", "alta"] } }, required: ["quando_usar", "abertura", "eficacia"] },
            whatsapp: { type: "object", properties: { quando_usar: { type: "string" }, abertura: { type: "string" }, eficacia: { type: "string", enum: ["baixa", "média", "alta"] } }, required: ["quando_usar", "abertura", "eficacia"] },
            linkedin: { type: "object", properties: { quando_usar: { type: "string" }, abertura: { type: "string" }, eficacia: { type: "string", enum: ["baixa", "média", "alta"] } }, required: ["quando_usar", "abertura", "eficacia"] },
            email: { type: "object", properties: { quando_usar: { type: "string" }, abertura: { type: "string" }, eficacia: { type: "string", enum: ["baixa", "média", "alta"] } }, required: ["quando_usar", "abertura", "eficacia"] },
            social_selling: { type: "object", properties: { quando_usar: { type: "string" }, abertura: { type: "string" }, eficacia: { type: "string", enum: ["baixa", "média", "alta"] } }, required: ["quando_usar", "abertura", "eficacia"] },
            ordem_recomendada: { type: "array", items: { type: "string" }, description: "Ordem ideal dos canais na cadência" },
          },
          required: ["cold_call", "whatsapp", "linkedin", "email", "social_selling", "ordem_recomendada"],
        },
        prospecting_strategy: {
          type: "object",
          properties: {
            cadencia: { type: "string" },
            canais: { type: "array", items: { type: "string" } },
            script_inicial: { type: "string" },
            sequencia_sdr: { type: "array", items: { type: "string" }, description: "Sequência dia-a-dia da cadência" },
          },
          required: ["cadencia", "canais", "script_inicial", "sequencia_sdr"],
        },
        action_plan: {
          type: "object",
          description: "Plano de ação prático e agressivo para o time comercial",
          properties: {
            primeiros_30_dias: { type: "array", items: { type: "string" } },
            metas_semanais: { type: "array", items: { type: "string" } },
            kpis_acompanhamento: { type: "array", items: { type: "string" } },
            riscos_e_mitigacao: { type: "array", items: { type: "string" } },
          },
          required: ["primeiros_30_dias", "metas_semanais", "kpis_acompanhamento", "riscos_e_mitigacao"],
        },
        product_fit: {
          type: "object",
          description: "Casamento entre os produtos/serviços da empresa e este ICP",
          properties: {
            oferta_principal: { type: "string", description: "Qual produto/serviço puxar primeiro para esse ICP" },
            angulo_pitch: { type: "string" },
            prova_social_ideal: { type: "string" },
            upsell_natural: { type: "string" },
            why_now: { type: "string", description: "Por que esse ICP deveria comprar AGORA" },
          },
          required: ["oferta_principal", "angulo_pitch", "prova_social_ideal", "upsell_natural", "why_now"],
        },
        scoring: {
          type: "object",
          properties: {
            fit_score: { type: "integer", minimum: 0, maximum: 100 },
            fit_label: { type: "string" },
            cac_estimado: { type: "string" },
            ltv_estimado: { type: "string" },
            potencial_fechamento: { type: "string", enum: ["baixo", "médio", "alto"] },
          },
          required: ["fit_score", "fit_label", "cac_estimado", "ltv_estimado", "potencial_fechamento"],
        },
        lead_score_criteria: {
          type: "array",
          description: "Critérios e pesos para Lead Score (devem somar 100)",
          items: {
            type: "object",
            properties: {
              key: { type: "string" },
              label: { type: "string" },
              weight: { type: "integer" },
              options: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    value: { type: "string" },
                    label: { type: "string" },
                    score: { type: "integer", minimum: 0, maximum: 100 },
                  },
                  required: ["value", "label", "score"],
                },
              },
            },
            required: ["key", "label", "weight", "options"],
          },
        },
      },
      required: ["profile", "buying_behavior", "pains", "desires", "beliefs", "decision_map", "channel_strategy", "prospecting_strategy", "action_plan", "product_fit", "scoring", "lead_score_criteria"],
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const { niche, segmento, produtos } = body || {};
    if (!niche || typeof niche !== "string") {
      return new Response(JSON.stringify({ error: "niche obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY ausente" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const ctxLines: string[] = [`Nicho-alvo do ICP: "${niche}"`];
    if (segmento) ctxLines.push(`Segmento da empresa que vende: "${segmento}"`);
    if (Array.isArray(produtos) && produtos.length) {
      const list = produtos.slice(0, 15).map((p: any) => `- ${p.nome || p.name}${p.preco ? ` (R$ ${p.preco})` : ""}${p.descricao ? `: ${p.descricao}` : ""}`).join("\n");
      ctxLines.push(`Portfólio de produtos/serviços da empresa:\n${list}`);
    }
    ctxLines.push("Use esse contexto para casar dores do ICP com as ofertas e gerar um plano de ataque agressivo e realista para o mercado brasileiro.");

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: ctxLines.join("\n\n") },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "generate_icp_intelligence" } },
      }),
    });

    if (resp.status === 429) return new Response(JSON.stringify({ error: "Rate limit. Tente novamente em instantes." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (resp.status === 402) return new Response(JSON.stringify({ error: "Créditos esgotados. Adicione créditos em Settings > Workspace > Usage." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI error", resp.status, t);
      return new Response(JSON.stringify({ error: "Erro no AI Gateway" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await resp.json();
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) {
      console.error("Sem tool_call", JSON.stringify(data));
      return new Response(JSON.stringify({ error: "IA não retornou estrutura esperada" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const intelligence = JSON.parse(call.function.arguments);

    return new Response(JSON.stringify({ niche, intelligence }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-icp-intelligence error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
