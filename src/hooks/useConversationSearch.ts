import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Conversation, Message } from './useConversationsCache';

function isInstagramPlaceholderName(value?: string | null): boolean {
  const name = String(value ?? '').trim();
  if (!name) return true;
  if (/^Contato\s+Instagram$/i.test(name)) return true;
  if (/^Instagram\s+\d+$/i.test(name)) return true;
  if (/^\d{10,}$/.test(name.replace(/^ig_/, ''))) return true;
  return false;
}

function getInstagramFallbackName(_value?: string | null): string {
  return 'Contato Instagram';
}

/**
 * Hook para busca de conversas diretamente no banco de dados
 * ✅ MELHORADO: Busca em conversas E leads para garantir que sempre encontre o contato
 */
export const useConversationSearch = (companyId: string | null) => {
  const [searchResults, setSearchResults] = useState<Conversation[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  /**
   * ✅ MELHORADO: Busca conversas no banco de dados por nome, telefone ou número
   * Agora busca também em leads para encontrar contatos mesmo sem conversas
   */
  const searchConversations = useCallback(async (query: string): Promise<Conversation[]> => {
    if (!companyId || !query.trim()) {
      setSearchResults([]);
      setHasSearched(false);
      return [];
    }

    setIsSearching(true);
    setHasSearched(true);

    try {
      const searchLower = query.toLowerCase().trim();
      const searchDigits = query.replace(/[^0-9]/g, '');

      console.log('🔍 [SEARCH] Buscando no banco:', { query, searchLower, searchDigits, companyId });

      // ========== 1. BUSCAR EM CONVERSAS ==========
      let conversasQuery = supabase
        .from('conversas')
        .select('id, numero, telefone_formatado, mensagem, nome_contato, tipo_mensagem, status, created_at, is_group, fromme, company_id, sent_by, owner_id, midia_url, origem, origem_api')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      // ✅ MELHORADO: Busca mais abrangente - sempre busca por nome E telefone
      if (searchDigits.length >= 3) {
        // Buscar por nome OU telefone (dígitos)
        conversasQuery = conversasQuery.or(`nome_contato.ilike.%${searchLower}%,telefone_formatado.ilike.%${searchDigits}%,numero.ilike.%${searchDigits}%`);
      } else {
        // Buscar por nome (case-insensitive)
        conversasQuery = conversasQuery.ilike('nome_contato', `%${searchLower}%`);
      }

      // ✅ MELHORADO: Aumentar limite para buscar mais resultados
      const { data: conversasResult, error: conversasError } = await conversasQuery.limit(1000);

      if (conversasError) {
        console.error('❌ [SEARCH] Erro ao buscar conversas:', conversasError);
      }

      const conversasData = conversasResult || [];
      console.log(`📊 [SEARCH] ${conversasData.length} mensagens encontradas em conversas`);

      // ========== 2. BUSCAR EM LEADS (para encontrar contatos sem conversas) ==========
      // ✅ Usando colunas corretas: 'name' ao invés de 'nome', 'phone' e 'telefone'
      let leadsQuery = supabase
        .from('leads')
        .select('id, name, phone, telefone, email, company, notes, created_at, tags, company_id')
        .eq('company_id', companyId);

      if (searchDigits.length >= 3) {
        leadsQuery = leadsQuery.or(`name.ilike.%${searchLower}%,phone.ilike.%${searchDigits}%,telefone.ilike.%${searchDigits}%`);
      } else {
        leadsQuery = leadsQuery.ilike('name', `%${searchLower}%`);
      }

      const { data: leadsResult, error: leadsError } = await leadsQuery.limit(200);

      if (leadsError) {
        console.error('❌ [SEARCH] Erro ao buscar leads:', leadsError);
      }

      const leadsData = leadsResult || [];
      console.log(`📊 [SEARCH] ${leadsData.length} leads encontrados`);

      // ========== 3. PROCESSAR E AGRUPAR CONVERSAS ==========
      const conversasMap = new Map<string, any[]>();
      const processedPhones = new Set<string>();

      conversasData.forEach(conv => {
        const isGroup = conv.is_group || /@g\.us$/.test(conv.numero || '');
        const normalizedDigits = String(conv.telefone_formatado || conv.numero || '').replace(/[^0-9]/g, '');
        const isMessenger = conv.origem === 'Messenger' || conv.origem === 'Facebook' || conv.origem === 'messenger';
        const isInstagram = !isMessenger && (conv.origem === 'Instagram' || (conv.origem_api === 'meta' && normalizedDigits.length >= 15));

        const key = isGroup
          ? String(conv.numero || '')
          : isInstagram
            ? `ig_${normalizedDigits}`
            : (normalizedDigits || '');

        if (!key) return;

        processedPhones.add(normalizedDigits || key);

        if (!conversasMap.has(key)) {
          conversasMap.set(key, []);
        }
        conversasMap.get(key)!.push(conv);
      });

      console.log(`📊 [SEARCH] ${conversasMap.size} conversas únicas de mensagens`);

      // ========== 4. ADICIONAR LEADS SEM CONVERSAS ==========
      leadsData.forEach(lead => {
        const leadPhone = (lead.telefone || lead.phone)?.replace(/[^0-9]/g, '') || '';
        if (!leadPhone || processedPhones.has(leadPhone)) return;

        // Criar uma conversa virtual para este lead
        conversasMap.set(leadPhone, [{
          id: `lead-${lead.id}`,
          numero: leadPhone,
          telefone_formatado: lead.telefone || lead.phone,
          mensagem: `📋 Lead cadastrado: ${lead.name || 'Sem nome'}`,
          nome_contato: lead.name || 'Lead',
          tipo_mensagem: 'texto',
          status: 'Pendente',
          created_at: lead.created_at,
          is_group: false,
          fromme: false,
          company_id: lead.company_id,
          lead_id: lead.id,
          origem_api: 'evolution',
          is_lead_only: true, // Marcador para identificar que é apenas lead
        }]);
        
        processedPhones.add(leadPhone);
      });

      console.log(`📊 [SEARCH] ${conversasMap.size} conversas únicas (incluindo leads)`);

      // ========== 5. CONVERTER PARA FORMATO CONVERSATION ==========
      const results: Conversation[] = Array.from(conversasMap.entries()).map(([telefone, mensagens]) => {
        const isGroup = mensagens[0]?.is_group || /@g\.us$/.test(telefone);

        // Ordenar mensagens por data
        const mensagensOrdenadas = mensagens
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        const messagensFormatadas: Message[] = mensagensOrdenadas.slice(-50).map(m => {
          const isFromMe = m.fromme === true || String(m.fromme) === 'true';
          return {
            id: m.id || `msg-${Date.now()}-${Math.random()}`,
            content: m.mensagem || '',
            type: (m.tipo_mensagem === 'texto' ? 'text' : m.tipo_mensagem || 'text') as any,
            sender: isFromMe ? "user" : "contact",
            timestamp: new Date(m.created_at || Date.now()),
            delivered: m.delivered === true || m.status === 'Enviada',
            read: m.read === true,
            mediaUrl: m.midia_url,
            sentBy: m.sent_by || undefined,
          };
        });

        const ultimaMensagem = messagensFormatadas[messagensFormatadas.length - 1];

        let statusConversa: "waiting" | "answered" | "resolved" = "waiting";
        const temResolvida = mensagens.some(m => m.status === 'Resolvida' || m.status === 'Finalizada');
        if (temResolvida) {
          statusConversa = "resolved";
        } else if (ultimaMensagem?.sender === 'user') {
          statusConversa = "answered";
        }

        const origemApi = mensagens.find(m => m.origem_api)?.origem_api || 'evolution';
        const leadId = mensagens.find(m => m.lead_id)?.lead_id;
        const isLeadOnly = mensagens.some(m => m.is_lead_only);
        const isInstagramConversation = telefone.startsWith('ig_') || mensagens.some(m => {
          const digits = String(m.telefone_formatado || m.numero || '').replace(/[^0-9]/g, '');
          const isMessenger = m.origem === 'Messenger' || m.origem === 'Facebook' || m.origem === 'messenger';
          return !isMessenger && (m.origem === 'Instagram' || (m.origem_api === 'meta' && digits.length >= 15));
        });
        const isMessengerConversation = !isInstagramConversation && mensagens.some(m => {
          return m.origem === 'Messenger' || m.origem === 'Facebook' || m.origem === 'messenger';
        });
        const bestNamedMessage = isInstagramConversation
          ? mensagens.find(m => {
              const name = String(m.nome_contato ?? '').trim();
              return name && !isInstagramPlaceholderName(name);
            })
          : mensagens.find(m => String(m.nome_contato ?? '').trim());
        const fallbackNamedMessage = mensagens.find(m => String(m.nome_contato ?? '').trim());
        const contactName = bestNamedMessage?.nome_contato
          || (isInstagramConversation ? getInstagramFallbackName(telefone) : fallbackNamedMessage?.nome_contato)
          || telefone;

        return {
          id: telefone,
          contactName,
          channel: isInstagramConversation ? "instagram" as const : isMessengerConversation ? "facebook" as const : "whatsapp" as const,
          status: statusConversa,
          lastMessage: ultimaMensagem?.content || '',
          unread: 0,
          messages: messagensFormatadas,
          tags: [],
          phoneNumber: telefone,
          isGroup,
          origemApi: origemApi as "evolution" | "meta",
          leadId,
          // ✅ Marcar se é apenas lead (para UI mostrar de forma diferente se necessário)
          isLeadOnly,
        };
      });

      // Ordenar por última mensagem (mais recentes primeiro)
      results.sort((a, b) => {
        const aTime = a.messages[a.messages.length - 1]?.timestamp?.getTime() || 0;
        const bTime = b.messages[b.messages.length - 1]?.timestamp?.getTime() || 0;
        return bTime - aTime;
      });

      console.log(`✅ [SEARCH] ${results.length} resultados totais retornados`);
      setSearchResults(results);
      setIsSearching(false);
      return results;
    } catch (error) {
      console.error('❌ [SEARCH] Erro:', error);
      setIsSearching(false);
      return [];
    }
  }, [companyId]);

  /**
   * Limpar resultados da busca
   */
  const clearSearch = useCallback(() => {
    setSearchResults([]);
    setHasSearched(false);
  }, []);

  return {
    searchResults,
    isSearching,
    hasSearched,
    searchConversations,
    clearSearch,
  };
};

/**
 * Função para carregar todas as conversas únicas (otimizado)
 * Carrega apenas última mensagem de cada conversa para listar
 */
export const loadAllUniqueConversations = async (companyId: string): Promise<Conversation[]> => {
  if (!companyId) return [];

  try {
    console.log('📊 [LOAD-ALL] Carregando todas as conversas únicas...');

    // Estratégia: Buscar mensagens ordenadas por data DESC e agrupar por telefone
    // Isso garante que pegamos a mensagem mais recente de cada conversa
    const { data: conversasResult, error } = await supabase
      .from('conversas')
      .select('id, numero, telefone_formatado, mensagem, nome_contato, tipo_mensagem, status, created_at, is_group, fromme, company_id, sent_by, midia_url, origem, origem_api')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(5000); // Limite alto para pegar todas as conversas

    if (error) {
      console.error('❌ [LOAD-ALL] Erro:', error);
      return [];
    }

    const conversasData = conversasResult || [];
    console.log(`📊 [LOAD-ALL] ${conversasData.length} mensagens carregadas`);

    // Validar e filtrar
    const validConversas = conversasData.filter(conv => {
      if (!conv.numero || conv.numero.includes('{{')) return false;
      if (!conv.mensagem || conv.mensagem.includes('{{')) return false;

      const telefoneNorm = String(conv.telefone_formatado || conv.numero || '').replace(/[^0-9]/g, '');
      const isGroup = conv.is_group || /@g\.us$/.test(conv.numero || '');
      const isMessenger = conv.origem === 'Messenger' || conv.origem === 'Facebook' || conv.origem === 'messenger';
      const isInstagram = !isMessenger && (conv.origem === 'Instagram' || (conv.origem_api === 'meta' && telefoneNorm.length >= 15));

      // Validar tamanho apenas para WhatsApp (Instagram usa IDs longos)
      if (telefoneNorm.length > 0 && !isGroup && !isInstagram) {
        if (telefoneNorm.length < 11 || telefoneNorm.length > 15) {
          return false;
        }
      }

      return true;
    });

    // Agrupar por telefone - pegar apenas a PRIMEIRA (mais recente) de cada
    const conversasMap = new Map<string, any>();
    const bestNamesMap = new Map<string, string>();
    validConversas.forEach(conv => {
      const isGroup = conv.is_group || /@g\.us$/.test(conv.numero || '');
      const normalizedDigits = String(conv.telefone_formatado || conv.numero || '').replace(/[^0-9]/g, '');
      const isMessenger = conv.origem === 'Messenger' || conv.origem === 'Facebook' || conv.origem === 'messenger';
      const isInstagram = !isMessenger && (conv.origem === 'Instagram' || (conv.origem_api === 'meta' && normalizedDigits.length >= 15));

      const key = isGroup
        ? String(conv.numero || '')
        : isInstagram
          ? `ig_${normalizedDigits}`
          : (normalizedDigits || '');

      if (!key) return;

      const candidateName = String(conv.nome_contato || '').trim();
      if (candidateName) {
        const canUseName = !isInstagram || !isInstagramPlaceholderName(candidateName);
        if (canUseName && !bestNamesMap.has(key)) {
          bestNamesMap.set(key, candidateName);
        }
      }

      // Só adicionar se ainda não existe (primeiro = mais recente porque ordenamos DESC)
      if (!conversasMap.has(key)) {
        conversasMap.set(key, conv);
      }
    });

    console.log(`📊 [LOAD-ALL] ${conversasMap.size} conversas únicas identificadas`);

    // ⚡ CORREÇÃO: Buscar nomes reais dos leads para Instagram (e outros)
    const telefonesParaBuscar = Array.from(conversasMap.keys()).map(tel => tel.replace(/[^0-9]/g, '')).filter(tel => tel.length >= 10);
    
    // Buscar leads para obter nomes corretos
    const leadsNamesMap = new Map<string, { name: string; leadId: string; profilePictureUrl?: string }>();
    if (telefonesParaBuscar.length > 0) {
      const BATCH_SIZE = 50;
      for (let i = 0; i < telefonesParaBuscar.length; i += BATCH_SIZE) {
        const batch = telefonesParaBuscar.slice(i, i + BATCH_SIZE);
        const { data: leadsData } = await supabase
          .from('leads')
          .select('id, phone, name, telefone, profile_picture_url')
          .eq('company_id', companyId)
          .or(batch.map(tel => `phone.ilike.%${tel}%,telefone.ilike.%${tel}%`).join(','))
          .limit(BATCH_SIZE);
        
        if (leadsData) {
          leadsData.forEach(lead => {
            const phoneKey = (lead.phone || lead.telefone || '').replace(/[^0-9]/g, '');
            if (phoneKey && lead.name && !isInstagramPlaceholderName(lead.name) && !/^\d{10,}$/.test(lead.name.trim())) {
              leadsNamesMap.set(phoneKey, {
                name: lead.name,
                leadId: lead.id,
                profilePictureUrl: lead.profile_picture_url || undefined,
              });
            }
          });
        }
      }
      console.log(`📇 [LOAD-ALL] ${leadsNamesMap.size} nomes de leads carregados`);
    }

    // Enriquecer bestNamesMap com nomes dos leads (prioridade maior)
    leadsNamesMap.forEach((leadInfo, phoneKey) => {
      // Buscar a key correspondente no conversasMap
      for (const key of conversasMap.keys()) {
        const keyDigits = key.replace(/^ig_/, '').replace(/[^0-9]/g, '');
        if (keyDigits === phoneKey || phoneKey.endsWith(keyDigits) || keyDigits.endsWith(phoneKey)) {
          bestNamesMap.set(key, leadInfo.name); // Sobrescrever com nome do lead
          break;
        }
      }
    });

    // Buscar assignments (assignedUser) para manter filtro "Transferidos"
    const assignmentsMap = new Map<string, { id: string; name: string }>();
    
    if (telefonesParaBuscar.length > 0) {
      const BATCH_SIZE = 100;
      let allAssignments: any[] = [];
      
      for (let i = 0; i < telefonesParaBuscar.length; i += BATCH_SIZE) {
        const batch = telefonesParaBuscar.slice(i, i + BATCH_SIZE);
        const { data: assignmentsData } = await supabase
          .from('conversation_assignments')
          .select('telefone_formatado, assigned_user_id')
          .eq('company_id', companyId)
          .in('telefone_formatado', batch);
        
        if (assignmentsData) {
          allAssignments = [...allAssignments, ...assignmentsData];
        }
      }

      // Buscar nomes dos usuários atribuídos
      const assignedUserIds = [...new Set(allAssignments.map(a => a.assigned_user_id).filter(Boolean))];
      const userNamesMap = new Map<string, string>();
      
      if (assignedUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', assignedUserIds);
        
        if (profiles) {
          profiles.forEach(p => userNamesMap.set(p.id, p.full_name || p.email || 'Usuário'));
        }
      }

      // Mapear assignments
      allAssignments.forEach((assignment: any) => {
        const telKey = assignment.telefone_formatado?.replace(/[^0-9]/g, '') || '';
        if (telKey && assignment.assigned_user_id) {
          const userName = userNamesMap.get(assignment.assigned_user_id) || 'Usuário';
          assignmentsMap.set(telKey, { id: assignment.assigned_user_id, name: userName });
        }
      });
      
      console.log(`👥 [LOAD-ALL] ${assignmentsMap.size} responsáveis carregados`);
    }

    // Converter para formato Conversation (com apenas 1 mensagem inicial)
    const conversations: Conversation[] = Array.from(conversasMap.entries()).map(([telefone, conv]) => {
      const isGroup = conv.is_group || /@g\.us$/.test(telefone);
      const isFromMe = conv.fromme === true || String(conv.fromme) === 'true';
      const normalizedDigits = String(conv.telefone_formatado || conv.numero || '').replace(/[^0-9]/g, '');
      const isMessengerConversation = conv.origem === 'Messenger' || conv.origem === 'Facebook' || conv.origem === 'messenger';
      const isInstagramConversation = telefone.startsWith('ig_') || (!isMessengerConversation && (conv.origem === 'Instagram' || (conv.origem_api === 'meta' && normalizedDigits.length >= 15)));
      const isMessengerConversationSafe = !isInstagramConversation && isMessengerConversation;

      const message: Message = {
        id: conv.id || `msg-${Date.now()}-${Math.random()}`,
        content: conv.mensagem || '',
        type: (conv.tipo_mensagem === 'texto' ? 'text' : conv.tipo_mensagem || 'text') as any,
        sender: isFromMe ? "user" : "contact",
        timestamp: new Date(conv.created_at || Date.now()),
        delivered: conv.delivered === true || conv.status === 'Enviada',
        read: conv.read === true, // ⚡ CORREÇÃO: Usar campo read do banco (true = contato visualizou)
        mediaUrl: conv.midia_url,
        sentBy: conv.sent_by || undefined,
      };

      const rawContactName = String(conv.nome_contato || '').trim();
      const contactName = bestNamesMap.get(telefone)
        || (isInstagramConversation
          ? (!isInstagramPlaceholderName(rawContactName) ? rawContactName : getInstagramFallbackName(telefone))
          : rawContactName || telefone);

      let statusConversa: "waiting" | "answered" | "resolved" = "waiting";
      if (conv.status === 'Resolvida' || conv.status === 'Finalizada') {
        statusConversa = "resolved";
      } else if (isFromMe) {
        statusConversa = "answered";
      }

      const origemApi = conv.origem_api || 'evolution';

      // ⚡ CRÍTICO: Incluir assignedUser do banco para manter filtro "Transferidos"
      const telKey = String(telefone).replace(/^ig_/, '').replace(/[^0-9]/g, '');
      const assignedUserData = assignmentsMap.get(telKey);
      const leadInfo = leadsNamesMap.get(telKey);

      // Avatar: usar foto do lead se disponível
      const avatarUrl = leadInfo?.profilePictureUrl
        ? leadInfo.profilePictureUrl
        : isInstagramConversation
          ? `https://ui-avatars.com/api/?name=${encodeURIComponent(contactName)}&background=E1306C&color=fff`
          : undefined;

      return {
        id: leadInfo?.leadId || telefone,
        contactName,
        channel: isInstagramConversation ? "instagram" as const : isMessengerConversationSafe ? "facebook" as const : "whatsapp" as const,
        status: statusConversa,
        lastMessage: message.content,
        unread: 0,
        messages: [message], // Apenas última mensagem inicialmente
        tags: [],
        phoneNumber: telefone,
        isGroup,
        avatarUrl,
        origemApi: origemApi as "evolution" | "meta",
        // ⚡ CORREÇÃO: Incluir assignedUser para filtro "Transferidos" funcionar
        responsavel: assignedUserData?.id,
        assignedUser: assignedUserData ? { id: assignedUserData.id, name: assignedUserData.name } : undefined,
      };
    });

    // Ordenar por última mensagem
    conversations.sort((a, b) => {
      const aTime = a.messages[0]?.timestamp?.getTime() || 0;
      const bTime = b.messages[0]?.timestamp?.getTime() || 0;
      return bTime - aTime;
    });

    console.log(`✅ [LOAD-ALL] ${conversations.length} conversas únicas retornadas`);
    return conversations;
  } catch (error) {
    console.error('❌ [LOAD-ALL] Erro:', error);
    return [];
  }
};
