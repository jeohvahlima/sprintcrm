import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CriarProfissionalRequest {
  nome: string
  email: string
  senha: string
  telefone?: string
  especialidade?: string
  valor_consulta?: number | null
  duracao_consulta?: number | null
  company_id: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Obter credenciais do Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase credentials')
    }

    // Cliente admin (service role) para criar usuário
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Parse do body
    const body: CriarProfissionalRequest = await req.json()
    const { nome, email, senha, telefone, especialidade, valor_consulta, duracao_consulta, company_id } = body

    console.log('[criar-profissional] Iniciando criação de profissional:', { email, nome })

    // Validações básicas
    if (!nome || !email || !senha || !company_id) {
      return new Response(
        JSON.stringify({ 
          error: 'Campos obrigatórios: nome, email, senha, company_id' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (senha.length < 6) {
      return new Response(
        JSON.stringify({ 
          error: 'A senha deve ter no mínimo 6 caracteres' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Verificar se profissional já existe
    const { data: existingProf } = await supabaseAdmin
      .from('profissionais')
      .select('id, user_id, nome, email')
      .eq('email', email)
      .maybeSingle()

    // Se profissional já existe, retornar seus dados
    if (existingProf) {
      console.log('[criar-profissional] Profissional já existe, retornando dados:', existingProf.id)
      return new Response(
        JSON.stringify({ 
          success: true,
          profissional: existingProf,
          message: 'Profissional já cadastrado',
          already_exists: true
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // 1. Criar usuário no Auth
    console.log('[criar-profissional] Criando usuário no Auth...')
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true, // Confirmar email automaticamente
      user_metadata: {
        full_name: nome,
        role: 'profissional'
      }
    })

    if (authError || !authUser.user) {
      console.error('[criar-profissional] Erro ao criar usuário no Auth:', authError)
      
      // Retornar mensagem de erro específica para email já cadastrado
      if (authError?.message?.includes('already been registered')) {
        return new Response(
          JSON.stringify({ 
            error: 'Este e-mail já está cadastrado. Use outro e-mail.' 
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
      
      return new Response(
        JSON.stringify({ 
          error: `Erro ao criar usuário: ${authError?.message || 'Erro desconhecido'}` 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('[criar-profissional] Usuário criado no Auth:', authUser.user.id)

    // 2. Criar registro na tabela profissionais
    console.log('[criar-profissional] Criando registro de profissional...')
    const { data: profissional, error: profError } = await supabaseAdmin
      .from('profissionais')
      .insert({
        user_id: authUser.user.id,
        nome,
        email,
        telefone: telefone || null,
        especialidade: especialidade || null,
        valor_consulta: valor_consulta ?? null,
        duracao_consulta: duracao_consulta && duracao_consulta > 0 ? duracao_consulta : 30,
        company_id
      })
      .select()
      .single()

    if (profError) {
      console.error('[criar-profissional] Erro ao criar profissional:', profError)
      // Se falhar ao criar profissional, deletar usuário criado
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id)
      throw new Error(`Erro ao criar profissional: ${profError.message}`)
    }

    console.log('[criar-profissional] Profissional criado com sucesso:', profissional.id)

    // 3. Criar profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: authUser.user.id,
        full_name: nome,
        email,
        role: 'profissional'
      })

    if (profileError) {
      console.warn('[criar-profissional] Aviso ao criar profile:', profileError)
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        profissional,
        message: 'Profissional criado com sucesso'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('[criar-profissional] Erro:', error)
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})