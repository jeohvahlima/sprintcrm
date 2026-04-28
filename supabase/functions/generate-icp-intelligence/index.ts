import { corsHeaders } from "@supabase/supabase-js/cors";

const SYSTEM = `Você é um estrategista comercial sênior especializado em ICP (Ideal Customer Profile), prospecção B2B e revenue operations. Sua função é analisar um nicho/segmento informado e devolver um diagnóstico estratégico completo em português do Brasil, baseado em melhores práticas de outbound, inbound e revenue science.

Seja específico, prático, com números realistas para o mercado brasileiro. Evite generalidades.`;

const TOOL = {
  type: "function",
  function: {
    name: "generate_icp_intelligence",
    description: "Gera o pacote completo de inteligência estratégica para um ICP a partir do nicho informado.",
    parameters: {
      type: "object",
      properties: {
        profile: {
          type: "object",
          description: "Perfil ideal do ICP",
          properties: {
            segmento: { type: "string" },
            subnichos: { type: "array", items: { type: "string" } },
            faturamento_mensal: { type: "string", description: "Faixa de faturamento ideal em R$/mês" },
            funcionarios: { type: "string" },
            estrutura_comercial: { type: "string" },
            ticket_medio_estimado: { type: "string" },
            ltv_estimado: { type: "string" },
            maturidade_comercial: { type: "string", enum: ["baixa", "média", "alta"] },
          },
          required: ["segmento", "subnichos", "faturamento_mensal", "funcionarios", "estrutura_comercial", "ticket_medio_estimado", "ltv_estimado", "maturidade_comercial"],
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
        desires: { type: "array", items: { type: "string" }, description: "Desejos e objetivos do ICP" },
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
            abordagens: { type: "array", items: { type: "string" } },
            melhores_horarios: { type: "array", items: { type: "string" } },
            objecoes_comuns: { type: "array", items: { type: "string" } },
            canais_recomendados: { type: "array", items: { type: "string" } },
          },
          required: ["decisores", "abordagens", "melhores_horarios", "objecoes_comuns", "canais_recomendados"],
        },
        prospecting_strategy: {
          type: "object",
          properties: {
            cadencia: { type: "string", description: "Cadência recomendada (ex: 12 toques em 21 dias)" },
            canais: { type: "array", items: { type: "string" } },
            script_inicial: { type: "string" },
            sequencia_sdr: { type: "array", items: { type: "string" } },
          },
          required: ["cadencia", "canais", "script_inicial", "sequencia_sdr"],
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
          description: "Critérios e pesos sugeridos para aplicar no Lead Score (devem somar 100)",
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
      required: ["profile", "pains", "desires", "beliefs", "decision_map", "prospecting_strategy", "scoring", "lead_score_criteria"],
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { niche } = await req.json();
    if (!niche || typeof niche !== "string") {
      return new Response(JSON.stringify({ error: "niche obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `Gere o ICP Intelligence completo para o nicho: "${niche}". Use dados realistas do mercado brasileiro.` },
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
    if (!call) throw new Error("IA não retornou tool_call");
    const intelligence = JSON.parse(call.function.arguments);

    return new Response(JSON.stringify({ niche, intelligence }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-icp-intelligence error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
