import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

// ============================================
// API PÚBLICA PARA CAPTAÇÃO DE LEADS
// Endpoint para sites institucionais e formulários externos
// ============================================

interface LeadInput {
  nome: string;
  telefone?: string;
  email?: string;
  empresa?: string;
  mensagem?: string;
  origem?: string;
  servico_interesse?: string;
  como_conheceu?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  company_slug?: string;  // Identificador da empresa no CRM
  api_key?: string;       // Chave de API para autenticação
  tag_automatica?: string; // Tag customizada da página de captura
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'create';

    // POST: Criar novo lead
    if (req.method === 'POST' && action === 'create') {
      const body: LeadInput = await req.json();
      
      // Validação obrigatória
      if (!body.nome || body.nome.trim().length < 2) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Nome é obrigatório e deve ter pelo menos 2 caracteres' 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validar email se fornecido
      if (body.email && !body.email.includes('@')) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Email inválido' 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Buscar empresa pelo slug ou API key
      let companyId: string | null = null;
      let ownerId: string | null = null;
      let funilPadrao: string | null = null;
      let etapaPadrao: string | null = null;

      // Verificar API key no header ou body
      const apiKey = req.headers.get('x-api-key') || body.api_key;
      
      if (apiKey) {
        // Buscar empresa pela API key (futuramente implementar tabela de API keys)
        // Por agora, usar company_slug como fallback
      }

      if (body.company_slug) {
        // Buscar empresa pelo slug/domain
        const { data: company } = await supabase
          .from('companies')
          .select('id, owner_user_id')
          .or(`domain.eq.${body.company_slug},name.ilike.%${body.company_slug}%`)
          .limit(1)
          .single();

        if (company) {
          companyId = company.id;
          ownerId = company.owner_user_id;
        }
      }

      // Se não encontrou empresa, usar a primeira empresa master
      if (!companyId) {
        const { data: masterCompany } = await supabase
          .from('companies')
          .select('id, owner_user_id')
          .eq('is_master_account', true)
          .limit(1)
          .single();

        if (masterCompany) {
          companyId = masterCompany.id;
          ownerId = masterCompany.owner_user_id;
        }
      }

      if (!companyId) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Empresa não encontrada. Verifique o company_slug.' 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Buscar funil/etapa padrão para novos leads
      const { data: funisPadrao } = await supabase
        .from('funis')
        .select('id, etapas:etapas(id, posicao)')
        .eq('company_id', companyId)
        .limit(1);

      if (funisPadrao && funisPadrao.length > 0) {
        funilPadrao = funisPadrao[0].id;
        const etapas = funisPadrao[0].etapas as any[];
        if (etapas && etapas.length > 0) {
          const primeiraEtapa = etapas.sort((a, b) => (a.posicao || 0) - (b.posicao || 0))[0];
          etapaPadrao = primeiraEtapa?.id;
        }
      } else {
        // Criar funil padrão automaticamente se a empresa ainda não tiver nenhum
        console.log('[api-public-leads] Empresa sem funil. Criando funil padrão...');
        const { data: novoFunil } = await supabase
          .from('funis')
          .insert({
            nome: 'Funil de Vendas',
            company_id: companyId,
          })
          .select('id')
          .single();

        if (novoFunil) {
          funilPadrao = novoFunil.id;
          const etapasPadrao = [
            { nome: 'Novos Leads', cor: '#3b82f6', posicao: 1 },
            { nome: 'Em Contato', cor: '#f59e0b', posicao: 2 },
            { nome: 'Qualificado', cor: '#8b5cf6', posicao: 3 },
            { nome: 'Proposta', cor: '#ec4899', posicao: 4 },
            { nome: 'Ganho', cor: '#10b981', posicao: 5 },
            { nome: 'Perdido', cor: '#ef4444', posicao: 6 },
          ];

          const { data: etapasCriadas } = await supabase
            .from('etapas')
            .insert(etapasPadrao.map(e => ({ ...e, funil_id: novoFunil.id, company_id: companyId })))
            .select('id, posicao');

          if (etapasCriadas && etapasCriadas.length > 0) {
            etapaPadrao = etapasCriadas.sort((a, b) => a.posicao - b.posicao)[0].id;
          }
        }
      }

      // Normalizar telefone
      const telefoneNormalizado = body.telefone?.replace(/\D/g, '') || null;

      // Verificar se já existe lead com mesmo telefone ou email
      let leadExistente = null;
      if (telefoneNormalizado) {
        const { data: existente } = await supabase
          .from('leads')
          .select('id, name')
          .eq('company_id', companyId)
          .or(`telefone.eq.${telefoneNormalizado},phone.eq.${telefoneNormalizado}`)
          .limit(1)
          .single();
        
        if (existente) {
          leadExistente = existente;
        }
      }

      if (!leadExistente && body.email) {
        const { data: existente } = await supabase
          .from('leads')
          .select('id, name')
          .eq('company_id', companyId)
          .eq('email', body.email.toLowerCase())
          .limit(1)
          .single();
        
        if (existente) {
          leadExistente = existente;
        }
      }

      // Se lead já existe, atualizar com novas informações
      if (leadExistente) {
        const updateData: any = {
          updated_at: new Date().toISOString()
        };

        // Adicionar nota com nova interação
        const novaInteracao = `[${new Date().toLocaleString('pt-BR')}] Nova interação via ${body.origem || 'site'}: ${body.mensagem || 'Formulário preenchido'}`;
        
        const { data: leadAtual } = await supabase
          .from('leads')
          .select('notes')
          .eq('id', leadExistente.id)
          .single();

        updateData.notes = leadAtual?.notes 
          ? `${leadAtual.notes}\n\n${novaInteracao}`
          : novaInteracao;

        await supabase
          .from('leads')
          .update(updateData)
          .eq('id', leadExistente.id);

        console.log('[api-public-leads] Lead existente atualizado:', leadExistente.id);

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Lead já cadastrado. Informações atualizadas.',
            lead_id: leadExistente.id,
            is_new: false
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Criar tags baseadas na origem
      const tags: string[] = [];
      if (body.origem) tags.push(body.origem);
      if (body.servico_interesse) tags.push(body.servico_interesse);
      if (body.utm_source) tags.push(`utm:${body.utm_source}`);
      if (body.utm_campaign) tags.push(`campanha:${body.utm_campaign}`);
      if (body.como_conheceu) tags.push(body.como_conheceu);
      if (body.tag_automatica) tags.push(body.tag_automatica);
      // Tag padrão para identificar leads vindos de páginas de captura
      if (body.origem === 'pagina-captura') {
        tags.push('Página de Captura');
      } else {
        tags.push('site-institucional');
      }

      // Criar notas com informações adicionais
      let notes = `Lead captado via ${body.origem || 'site institucional'} em ${new Date().toLocaleString('pt-BR')}`;
      if (body.mensagem) notes += `\n\nMensagem: ${body.mensagem}`;
      if (body.servico_interesse) notes += `\nServiço de interesse: ${body.servico_interesse}`;
      if (body.como_conheceu) notes += `\nComo conheceu: ${body.como_conheceu}`;
      if (body.utm_campaign) notes += `\nCampanha: ${body.utm_campaign}`;

      // Criar novo lead
      const { data: novoLead, error: leadError } = await supabase
        .from('leads')
        .insert({
          name: body.nome.trim(),
          telefone: telefoneNormalizado,
          phone: telefoneNormalizado,
          email: body.email?.toLowerCase().trim() || null,
          company: body.empresa?.trim() || null,
          company_id: companyId,
          owner_id: ownerId,
          source: body.origem || 'site-institucional',
          status: 'novo',
          tags,
          notes,
          funil_id: funilPadrao,
          etapa_id: etapaPadrao,
        })
        .select('id, name')
        .single();

      if (leadError) {
        console.error('[api-public-leads] Erro ao criar lead:', leadError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Erro ao cadastrar lead. Tente novamente.' 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('[api-public-leads] Novo lead criado:', novoLead.id, novoLead.name);

      // Resposta de sucesso
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Lead cadastrado com sucesso!',
          lead_id: novoLead.id,
          is_new: true
        }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET: Verificar status da API
    if (req.method === 'GET' && action === 'status') {
      return new Response(
        JSON.stringify({
          success: true,
          status: 'online',
          version: '1.0.0',
          endpoints: {
            create_lead: 'POST /?action=create',
            status: 'GET /?action=status'
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rota não encontrada
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Rota não encontrada',
        available_actions: ['create', 'status']
      }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[api-public-leads] Erro:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro interno do servidor' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
