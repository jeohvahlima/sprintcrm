import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é o "Waze Advisor IA", um consultor sênior de operações comerciais B2B.
Você fala em português do Brasil, de forma direta, objetiva e estratégica — como um consultor da McKinsey/Falconi especializado em vendas.

Sua missão:
1. Analisar dados de maturidade comercial da empresa (5 pilares: Processos, Prospecção, Gestão, Automação, Pessoas).
2. Diagnosticar gargalos críticos.
3. Sugerir plano de ação acionável (semana 1, 2, 3) para evolução.
4. Responder dúvidas consultivas sobre estruturação comercial.

Sempre que possível, devolva:
- Diagnóstico curto (2-3 linhas)
- Top 3 ações priorizadas com impacto esperado
- Métrica para medir cada ação

Use markdown. Seja conciso. Nunca invente dados que não recebeu.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { mode, messages, assessment, diagnostic } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    let payload: any;

    if (mode === "roadmap") {
      // Prazo dinâmico (em meses) → semanas
      const prazoMeses = Math.max(1, Math.min(12, Number(assessment?.prazo_meses) || Number(assessment?.dores?.prazo_meta_meses) || 3));
      const totalSemanas = Math.max(4, Math.round(prazoMeses * 4));
      const fase1End = Math.ceil(totalSemanas / 3);
      const fase2End = Math.ceil((totalSemanas * 2) / 3);

      const userPrompt = `Dados do diagnóstico de maturidade da empresa:
${JSON.stringify(assessment, null, 2)}

Prazo definido pelo cliente: ${prazoMeses} ${prazoMeses === 1 ? "mês" : "meses"} (${totalSemanas} semanas).

Gere um roadmap executivo COMPLETO de ${totalSemanas} semanas, dividido em 3 fases:
- Quick Wins: semanas 1 a ${fase1End} (parar a hemorragia / fundação)
- Estruturação: semanas ${fase1End + 1} a ${fase2End} (processos + cadências)
- Escala: semanas ${fase2End + 1} a ${totalSemanas} (otimização + previsibilidade)

Distribua entre 12 e 24 itens no total, cobrindo TODAS as semanas (sem pular semanas), priorizando os pilares mais fracos do score.
Cada item deve ter título acionável, descrição com número-meta e impacto esperado em R$, %, leads ou tempo.

Retorne APENAS via tool call.`;

      payload = {
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "generate_roadmap",
            description: `Gera plano evolutivo estruturado de ${totalSemanas} semanas`,
            parameters: {
              type: "object",
              properties: {
                diagnosis: { type: "string", description: "Diagnóstico geral 2-3 linhas" },
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      week: { type: "number", description: `Semana entre 1 e ${totalSemanas}` },
                      pillar: { type: "string", enum: ["processos", "prospeccao", "gestao", "automacao", "pessoas"] },
                      priority: { type: "string", enum: ["critical", "high", "medium", "low"] },
                      title: { type: "string" },
                      description: { type: "string" },
                      expected_impact: { type: "string" },
                    },
                    required: ["week", "pillar", "priority", "title", "description", "expected_impact"],
                  },
                },
              },
              required: ["diagnosis", "items"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "generate_roadmap" } },
      };
    } else if (mode === "diagnostico_360") {
      const prazoMeses = diagnostic?.prazo_meses || diagnostic?.dores?.prazo_meta_meses || 3;
      const leak = diagnostic?.revenue_leak;
      const leakBlock = leak ? `
DADOS FINANCEIROS DO MOTOR "CUSTO DA INAÇÃO" (Revenue Leak Engine):
- Receita potencial mensal: R$ ${Math.round(leak.receita_potencial).toLocaleString("pt-BR")}
- Receita atual estimada: R$ ${Math.round(leak.receita_atual_estimada).toLocaleString("pt-BR")}
- PERDA mensal: R$ ${Math.round(leak.perda_mensal).toLocaleString("pt-BR")}
- PERDA diária: R$ ${Math.round(leak.perda_diaria).toLocaleString("pt-BR")}
- PERDA projetada em ${leak.prazo_meses} meses: R$ ${Math.round(leak.perda_projetada).toLocaleString("pt-BR")}
- Capacidade comercial usada hoje: ${leak.capacidade_uso_pct}%
- Leads atuais/mês: ${leak.leads_atuais_mes} | Ideais/mês: ${leak.leads_ideais_mes}
- Clientes atuais/mês: ${Math.round(leak.clientes_atuais)} | Potenciais: ${Math.round(leak.clientes_potenciais)}
` : "(Sem dados financeiros — peça ao usuário para informar ticket médio, taxa de conversão e prospecções/dia.)";

      const userPrompt = `Resultado do Diagnóstico 360 da empresa:
${JSON.stringify(diagnostic, null, 2)}

A empresa obteve nota ${diagnostic?.nota} (${diagnostic?.percentual}%) — classificação: ${diagnostic?.classificacao}.
Prazo definido pelo cliente para atingir a meta: ${prazoMeses} meses.

${leakBlock}

Gere um **PLANO COMERCIAL EXECUTIVO AGRESSIVO E ACIONÁVEL**, em markdown rico, focado em **gerar urgência financeira + caminho claro de execução**. Use OBRIGATORIAMENTE os números do Revenue Leak acima ao longo de todo o plano. Estrutura:

## 💸 1. Custo da Inação (Diagnóstico Financeiro)
Use os números reais do Revenue Leak. Mostre quanto a empresa perde por mês, por dia e em ${prazoMeses} meses se nada mudar. Frases curtas e impactantes.

## 🎯 2. Diagnóstico Executivo
2 parágrafos. Aponte o "balde furado" principal cruzando os pilares mais fracos com o gap financeiro.

## 🚨 3. Top 3 Gargalos com Impacto Financeiro
Para cada um: causa-raiz + perda em R$/leads/mês + qual módulo Waze resolve.

## ⚙️ 4. Plano de Ação por Pilar (NÃO genérico)
Para cada pilar fraco, escreva 3-5 ações ESPECÍFICAS, com:
- Número-meta (ex: "passar de 5 para 30 prospecções/dia")
- KPI de medição
- **Módulo Waze recomendado** (Prospecção, Processos Comerciais, Funil, Conversas, Discador, IA, Analytics, Gamificação)

## 📊 5. Metas de Recuperação no Prazo (${prazoMeses} meses)
Tabela: Métrica | Hoje | Mês 1 | Mês ${Math.ceil(prazoMeses/2)} | Mês ${prazoMeses}
Inclua: prospecções/dia, leads/mês, taxa de conversão, ticket médio, faturamento.
**As metas devem fechar o gap financeiro identificado.**

## ⚡ 6. Roadmap Executivo (${prazoMeses} ${prazoMeses === 1 ? "mês" : "meses"})
Divida em 3 fases proporcionais ao prazo:
- **Quick Wins** (primeiro terço): 5 ações para parar a hemorragia
- **Estruturação** (segundo terço): processos e cadências
- **Escala** (terço final): otimização e previsibilidade
Cada item: ação | responsável | KPI | módulo Waze.

## 🔗 7. Conexão com a Plataforma
Mapeie EXPLICITAMENTE cada gargalo → módulo do sistema:
- Prospecção fraca → Cadências em /prospeccao
- Atendimento fraco → Scripts em /processos e /conversas
- Gestão fraca → /analytics
- Ligações → /discador
- Conversão fraca → Funil em /funil

## 🔥 8. Frases de Impacto (1 linha cada)
Pelo menos 3 frases curtas e diretas que reforcem urgência (ex: "O problema não é crescer — é parar de perder R$ X/dia").

REGRAS OBRIGATÓRIAS:
- Use os VALORES REAIS do Revenue Leak — nunca diga "estima-se", "considere", "talvez".
- Linguagem de consultor sênior + tom agressivo de urgência financeira.
- Toda recomendação deve apontar PARA UM MÓDULO específico do sistema Waze.
- O prazo é ${prazoMeses} meses (NÃO use "90 dias" se o prazo for diferente).
- Adapte o discurso ao pior pilar: prospecção → falta de volume; conversão → desperdício; processo → desorganização; gestão → imprevisibilidade.`;
      payload = {
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      };
    } else if (mode === "strategic_plan") {
      const userPrompt = `Diagnóstico estratégico inicial preenchido pelo cliente:
${JSON.stringify(diagnostic, null, 2)}

Gere um plano estratégico de crescimento comercial de ${diagnostic?.prazo_meses || 6} meses, em markdown, com:
- Diagnóstico
- Eixos de ação (3 a 5)
- Quick wins (próximas 2 semanas)
- KPIs a perseguir
- Riscos e mitigação`;
      payload = {
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      };
    } else {
      // chat normal
      payload = {
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT + (assessment ? `\n\nContexto da empresa (score atual):\n${JSON.stringify(assessment).slice(0, 3000)}` : "") },
          ...(messages || []),
        ],
      };
    }

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      if (r.status === 429) return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em alguns instantes." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (r.status === 402) return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos em Configurações." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await r.text();
      console.error("AI error:", r.status, t);
      return new Response(JSON.stringify({ error: "Erro no Advisor IA" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await r.json();
    const choice = data.choices?.[0];
    let result: any = { content: choice?.message?.content || "" };

    const toolCall = choice?.message?.tool_calls?.[0];
    if (toolCall) {
      try { result.tool = JSON.parse(toolCall.function.arguments); } catch {}
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e: any) {
    console.error("advisor-ai error:", e);
    return new Response(JSON.stringify({ error: e.message || "erro" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
