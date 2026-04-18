// Edge function: gerar-conteudo-site
// Gera conteúdo de seções do site institucional usando Lovable AI

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SECAO_PROMPTS: Record<string, (empresa: string, segmento: string, ctx: any) => string> = {
  hero: (e, s) => `Gere um título e subtítulo de hero para o site da empresa "${e}" do segmento "${s}". Responda em JSON: {"hero_titulo":"...","hero_subtitulo":"...","hero_cta_texto":"..."}. Título impactante (max 8 palavras). Subtítulo até 20 palavras. CTA até 3 palavras. Português brasileiro.`,
  sobre: (e, s) => `Gere a seção "Sobre" do site de "${e}" (segmento "${s}"). JSON: {"sobre_titulo":"...","sobre_texto":"...","sobre_missao":"...","sobre_visao":"...","sobre_valores":["...","...","...","..."]}. Texto até 60 palavras. Missão/visão objetivas. 4 valores. Português brasileiro.`,
  servicos: (e, s) => `Liste 6 serviços típicos de "${e}" (segmento "${s}"). JSON: {"servicos":[{"nome":"...","descricao":"..."}]}. Descrição até 15 palavras. Português brasileiro.`,
  faq: (e, s) => `Gere 6 perguntas frequentes (com resposta) para "${e}" (segmento "${s}"). JSON: {"faq":[{"pergunta":"...","resposta":"..."}]}. Respostas claras, até 30 palavras. Português brasileiro.`,
  depoimentos: (e, s) => `Gere 3 depoimentos realistas de clientes para "${e}" (segmento "${s}"). JSON: {"depoimentos":[{"nome":"Nome Completo","texto":"depoimento curto","estrelas":5}]}. Português brasileiro.`,
  equipe: (e, s) => `Gere 4 perfis de equipe fictícios mas realistas para "${e}" (segmento "${s}"). JSON: {"equipe":[{"nome":"Nome Completo","cargo":"Cargo","bio":"bio curta até 15 palavras"}]}. Português brasileiro.`,
  planos: (e, s) => `Gere 3 planos comerciais (Básico, Profissional, Premium) para "${e}" (segmento "${s}"). JSON: {"planos":[{"nome":"...","preco":"R$ 99","periodo":"mês","descricao":"...","destaque":false,"itens":["item1","item2","item3","item4","item5"],"cta_texto":"Contratar"}]}. O plano do meio deve ter "destaque": true. Português brasileiro.`,
  blog: (e, s) => `Gere 3 posts de blog relevantes para "${e}" (segmento "${s}"). JSON: {"blog_posts":[{"titulo":"...","resumo":"resumo até 25 palavras","autor":"Equipe ${e}","data":"hoje"}]}. Títulos chamativos. Português brasileiro.`,
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { empresa, segmento, secao, contexto } = await req.json();
    if (!empresa || !secao) {
      return new Response(JSON.stringify({ error: 'empresa e secao são obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const promptBuilder = SECAO_PROMPTS[secao];
    if (!promptBuilder) {
      return new Response(JSON.stringify({ error: `Seção "${secao}" não suportada` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const prompt = promptBuilder(empresa, segmento || 'geral', contexto || {});
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY não configurada');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'Você é um copywriter profissional brasileiro. Responda APENAS com JSON válido, sem markdown.' },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (response.status === 429) {
      return new Response(JSON.stringify({ error: 'Limite de requisições atingido. Aguarde alguns segundos.' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (response.status === 402) {
      return new Response(JSON.stringify({ error: 'Créditos de IA esgotados.' }), {
        status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!response.ok) {
      const t = await response.text();
      throw new Error(`AI error: ${t}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    let resultado: any = {};
    try { resultado = JSON.parse(cleaned); } catch { resultado = { raw: cleaned }; }

    // Adiciona data atual nos posts de blog
    if (secao === 'blog' && Array.isArray(resultado.blog_posts)) {
      const hoje = new Date().toLocaleDateString('pt-BR');
      resultado.blog_posts = resultado.blog_posts.map((p: any) => ({ ...p, data: p.data === 'hoje' ? hoje : p.data || hoje }));
    }

    return new Response(JSON.stringify({ resultado }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('gerar-conteudo-site error:', e);
    return new Response(JSON.stringify({ error: e.message || 'Erro interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
