import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Conversation, Message } from './useConversationsCache';

/**
 * Hook para carregar conversas com paginação e otimização
 * Implementa lazy loading e cache
 */
export const useConversationsLoader = () => {
  const [conversationsLimit, setConversationsLimit] = useState(30);
  const [conversationsOffset, setConversationsOffset] = useState(0);
  const [hasMoreConversations, setHasMoreConversations] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(false);

  const loadInitialConversations = useCallback(async (
    userCompanyId: string,
    conversations: Conversation[],
    append: boolean = false
  ) => {
    try {
      setLoadingConversations(true);

      if (!userCompanyId) {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          toast.error('Você precisa estar logado');
          setLoadingConversations(false);
          return [];
        }
        
        const { data: userRole } = await supabase
          .from('user_roles')
          .select('company_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!userRole?.company_id) {
          toast.error('Erro: Usuário sem empresa associada');
          setLoadingConversations(false);
          return [];
        }

        userCompanyId = userRole.company_id;
      }
      
      // ⚡ OTIMIZAÇÃO EXTREMA: Carregar menos mensagens para performance
      const MESSAGES_TO_FETCH = append ? 100 : 300; // Reduzido para carregamento rápido
      
      console.log(`📊 [LOAD] Carregando ${MESSAGES_TO_FETCH} mensagens recentes...`);
      
      // ⚡ OTIMIZAÇÃO: Query com campos essenciais + origem/origem_api para identificação visual
      let query = supabase
        .from('conversas')
        .select('id, numero, telefone_formatado, mensagem, nome_contato, tipo_mensagem, status, created_at, is_group, fromme, company_id, sent_by, assigned_user_id, owner_id, midia_url, origem, origem_api, group_subject, group_participant_name, group_participant_phone, group_participant_avatar_url')
        .eq('company_id', userCompanyId)
        .order('created_at', { ascending: false });
      
      if (append && conversations.length > 0) {
        const todasMensagens = conversations.flatMap(c => c.messages);
        if (todasMensagens.length > 0) {
          const dataMaisAntiga = todasMensagens
            .map(m => m.timestamp instanceof Date ? m.timestamp : new Date(m.timestamp))
            .sort((a, b) => a.getTime() - b.getTime())[0];
          
          query = query.lt('created_at', dataMaisAntiga.toISOString());
        }
      }
      
      query = query.limit(MESSAGES_TO_FETCH);
      
      const { data: conversasResult, error: conversasError } = await query;

      if (conversasError) {
        toast.error('Erro ao carregar conversas');
        setLoadingConversations(false);
        return [];
      }

      const conversasData = conversasResult || [];
      
      // ⚡ CORREÇÃO CRÍTICA: Validar company_id e FILTRAR NÚMEROS INVÁLIDOS E DE OUTRAS INSTÂNCIAS
      const validConversas = conversasData.filter(conv => {
        // Validação 1: company_id DEVE ser exatamente igual
        if (conv.company_id !== userCompanyId) {
          console.warn(`⚠️ [FILTRO] Mensagem de outra company ignorada: ${conv.company_id}`);
          return false;
        }
        
        // Validação 2: Conteúdo básico
        if (!conv.numero || conv.numero.includes('{{')) return false;
        if (!conv.mensagem || conv.mensagem.includes('{{')) return false;
        
        // Validação 3: VALIDAR tamanho do telefone - permitir Instagram IDs (15+ dígitos)
        const telefoneNormalizado = conv.telefone_formatado?.replace(/[^0-9]/g, '') || conv.numero?.replace(/[^0-9]/g, '') || '';
        const isMessenger = conv.origem === 'Messenger' || conv.origem === 'Facebook' || conv.origem === 'messenger';
        const isInstagram = !isMessenger && conv.origem_api === 'meta' && telefoneNormalizado.length >= 15;
        const isGroup = conv.is_group || /@g\.us$/.test(conv.numero || '');
        
        // Instagram IDs e grupos não seguem validação de telefone brasileiro
        if (!isInstagram && !isGroup && telefoneNormalizado.length > 0) {
          if (telefoneNormalizado.length < 11 || telefoneNormalizado.length > 13) {
            console.warn(`🚫 [FILTRO CRÍTICO] Telefone malformado bloqueado: ${telefoneNormalizado} (${telefoneNormalizado.length} dígitos)`);
            return false;
          }
        }
        
        return true;
      });

      // ⚡ CORREÇÃO DEFINITIVA: Agrupar conversas por telefone normalizado para eliminar duplicação
      const conversasMap = new Map<string, any[]>();
      validConversas.forEach(conv => {
        const isGroup = conv.is_group || /@g\.us$/.test(conv.numero || '');
        const normalizedDigits = String(conv.telefone_formatado || conv.numero || '').replace(/[^0-9]/g, '');
        const isMessenger = conv.origem === 'Messenger' || conv.origem === 'Facebook' || conv.origem === 'messenger';
        const isInstagram = !isMessenger && conv.origem_api === 'meta' && normalizedDigits.length >= 15;
        
        let key: string;
        if (isGroup) {
          key = conv.numero; // Grupos mantêm o ID original
        } else if (isInstagram) {
          // ⚡ Instagram IDs: usar prefixo ig_ para não confundir com telefone
          key = `ig_${normalizedDigits}`;
        } else {
          // Telefone WhatsApp: normalizar
          let digits = normalizedDigits;
          
          // Detectar DDI duplicado (ex: 5515578500694049 -> últimos 12 dígitos)
          if (digits.length > 13) {
            digits = digits.substring(digits.length - 12);
          }
          
          key = digits;
        }
        
        if (!key) {
          key = conv.numero;
        }
        
        if (!conversasMap.has(key)) {
          conversasMap.set(key, []);
        }
        conversasMap.get(key)!.push(conv);
      });

      // ⚡ OTIMIZAÇÃO: Buscar apenas leads necessários com query filtrada
      const telefonesUnicos = Array.from(conversasMap.keys())
        .map(tel => tel.replace(/[^0-9]/g, ''))
        .filter(tel => tel.length >= 10);
      
      let leadsData: any[] = [];
      if (telefonesUnicos.length > 0) {
        // Buscar em lotes para evitar queries muito grandes
        const batchSize = 50;
        for (let i = 0; i < telefonesUnicos.length; i += batchSize) {
          const batch = telefonesUnicos.slice(i, i + batchSize);
          
          const leadsResult = await supabase
            .from('leads')
            .select('id, phone, name, telefone, profile_picture_url')
            .eq('company_id', userCompanyId)
            .or(batch.map(tel => `phone.ilike.%${tel}%,telefone.ilike.%${tel}%`).join(','))
            .limit(batchSize);
          
          if (!leadsResult.error && leadsResult.data) {
            leadsData.push(...leadsResult.data);
          }
        }
      }
      
      console.log(`📊 [LOAD] ${conversasData.length} mensagens, ${conversasMap.size} conversas, ${leadsData.length} leads`);
      
      const leadsMap = new Map<string, { name: string; leadId: string; profilePictureUrl?: string }>();
      leadsData.forEach(lead => {
        const phoneRaw = lead.phone || lead.telefone;
        if (!phoneRaw) return;
        
        const phoneKey = phoneRaw.replace(/[^0-9]/g, '');
        if (phoneKey) {
          leadsMap.set(phoneKey, {
            name: lead.name || phoneKey,
            leadId: lead.id,
            profilePictureUrl: lead.profile_picture_url || undefined,
          });
        }
      });

      // ⚡ Buscar informações dos usuários responsáveis pelo atendimento
      const assignedUserIds = Array.from(new Set(
        validConversas
          .map(c => c.assigned_user_id)
          .filter(id => id)
      ));
      
      const usersMap = new Map<string, { id: string; name: string; avatar?: string }>();
      if (assignedUserIds.length > 0) {
        const { data: usersData } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', assignedUserIds);
        
        if (usersData) {
          usersData.forEach(user => {
            usersMap.set(user.id, {
              id: user.id,
              name: user.full_name || user.id,
              avatar: user.avatar_url || undefined
            });
          });
        }
      }
      
      // ⚡ CORREÇÃO: Buscar nomes dos usuários por owner_id para exibir assinatura correta
      const ownerIds = Array.from(new Set(
        validConversas
          .filter(c => c.owner_id && (c.fromme === true || String(c.fromme) === 'true'))
          .map(c => c.owner_id)
      ));
      
      const ownerNamesMap = new Map<string, string>();
      if (ownerIds.length > 0) {
        const { data: ownersData } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', ownerIds);
        
        if (ownersData) {
          ownersData.forEach(owner => {
            ownerNamesMap.set(owner.id, owner.full_name || owner.email || 'Usuário');
          });
        }
        console.log(`👥 [LOAD] ${ownerNamesMap.size} nomes de usuários carregados por owner_id`);
      }

      // Criar conversas - ⚡ CORREÇÃO DEFINITIVA: Priorizar nome do lead e unificar nomes variantes
      const novasConversas: Conversation[] = Array.from(conversasMap.entries())
        .map(([telefone, mensagens]) => {
          // Para Instagram, buscar lead pelo ID sem prefixo ig_
          const lookupKey = telefone.replace(/^ig_/, '').replace(/[^0-9]/g, '');
          const leadInfo = leadsMap.get(lookupKey) || leadsMap.get(telefone);
          const isGroup = mensagens[0]?.is_group || /@g\.us$/.test(telefone);
          const isInstagramConversation = telefone.startsWith('ig_') || mensagens.some(m => {
            const digits = String(m.telefone_formatado || m.numero || '').replace(/[^0-9]/g, '');
            const isMessenger = m.origem === 'Messenger' || m.origem === 'Facebook' || m.origem === 'messenger';
            return !isMessenger && (m.origem === 'Instagram' || (m.origem_api === 'meta' && digits.length >= 15));
          });
          const isMessengerConversation = !isInstagramConversation && mensagens.some(m => {
            return m.origem === 'Messenger' || m.origem === 'Facebook' || m.origem === 'messenger';
          });
          
          // Helper: verificar se nome é um placeholder numérico do Instagram
          const isBadInstagramName = (name: string | undefined | null): boolean => {
            if (!name || name.trim() === '') return true;
            const n = name.trim();
            if (/^\d{10,}$/.test(n)) return true; // Apenas dígitos (ID numérico)
            if (/^ig_\d+$/.test(n)) return true;
            if (/^Contato\s+Instagram$/i.test(n)) return true;
            if (/^Instagram\s+\d+$/i.test(n)) return true;
            if (n === telefone || n === lookupKey) return true;
            return false;
          };
          
          // ⚡ PRIORIDADE 1: Nome do lead cadastrado no CRM (mais confiável)
          let contactName = leadInfo?.name;
          
          // Se nome do lead é um placeholder numérico, ignorar
          if (isInstagramConversation && isBadInstagramName(contactName)) {
            contactName = undefined;
          }
          
          // 👥 GRUPOS: priorizar group_subject (nome real do grupo)
          if (isGroup) {
            const subjects = mensagens
              .map((m: any) => m.group_subject?.trim())
              .filter((s: string) => s && s.length > 0);
            if (subjects.length > 0) {
              contactName = subjects[subjects.length - 1] || subjects[0];
            }
          }

          // Se não tem lead ou nome é inválido, buscar melhor nome nas mensagens
          if (!contactName || contactName === telefone || contactName.trim() === '') {
            // ⚡ PRIORIDADE 2: Buscar o nome mais completo nas mensagens
            const nomesEncontrados = mensagens
              .map(m => m.nome_contato?.trim())
              .filter(nome => {
                if (!nome || nome === telefone) return false;
                // Para Instagram, filtrar nomes numéricos
                if (isInstagramConversation && isBadInstagramName(nome)) return false;
                return true;
              });
            
            // Pegar o nome mais longo (geralmente é o mais completo)
            if (nomesEncontrados.length > 0) {
              contactName = nomesEncontrados.reduce((longest, current) => 
                (current?.length || 0) > (longest?.length || 0) ? current : longest
              );
            }
          }
          
          // ⚡ Fallback baseado no tipo da conversa
          if (!contactName || contactName.trim() === '') {
            if (isGroup) {
              contactName = 'Grupo';
            } else if (isInstagramConversation) {
              contactName = `Contato Instagram`; // Placeholder legível em vez de número
            } else {
              contactName = telefone;
            }
          }
          
          // MELHORIA: Carregar TODAS as mensagens carregadas do banco
          const messagensFormatadas: Message[] = mensagens
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
            .map((m: any) => {
              const isFromMe = m.fromme === true || String(m.fromme) === 'true';
              // ⚡ CORREÇÃO DEFINITIVA: Usar sent_by do banco, com fallback pelo owner_id
              let sentBy = m.sent_by || undefined;
              
              if (!sentBy && isFromMe && m.owner_id) {
                sentBy = ownerNamesMap.get(m.owner_id) || "Equipe";
              } else if (!sentBy && isFromMe) {
                sentBy = "Equipe"; // Fallback final
              }
              
              return {
                id: m.id || `msg-${Date.now()}-${Math.random()}`,
                content: m.mensagem || '',
                type: (m.tipo_mensagem === 'texto' ? 'text' : m.tipo_mensagem || 'text') as any,
                sender: isFromMe ? "user" : "contact",
                timestamp: new Date(m.created_at || Date.now()),
                delivered: m.delivered === true || m.status === 'Enviada',
                read: m.read === true, // ⚡ CORREÇÃO: Usar campo read do banco (true = contato visualizou)
                mediaUrl: m.midia_url,
                sentBy: sentBy, // ✅ CORREÇÃO: Incluir assinatura com fallback correto
                participantName: (m as any).group_participant_name || undefined, // 👥 Nome do remetente em grupos
                participantPhone: (m as any).group_participant_phone || undefined,
                participantAvatarUrl: (m as any).group_participant_avatar_url || undefined,
              };
            });

          const ultimaMensagem = messagensFormatadas[messagensFormatadas.length - 1];
          let statusConversa: "waiting" | "answered" | "resolved" = "waiting";
          
          const temMensagemResolvida = mensagens.some(m => m.status === 'Resolvida' || m.status === 'Finalizada');
          if (temMensagemResolvida) {
            statusConversa = "resolved";
          } else if (ultimaMensagem) {
            if (ultimaMensagem.sender === 'user') {
              statusConversa = "answered";
            } else {
              // ⚡ MELHORIA: Verificar se é uma conversa "ao vivo" (interação recente)
              // Se o usuário respondeu recentemente, manter em "Em Atendimento"
              const TEMPO_CONVERSA_AO_VIVO = 5 * 60 * 1000; // 5 minutos (ajustado para atendimento ativo)
              const agora = Date.now();
              
              const ultimaMensagemDoUsuario = [...messagensFormatadas]
                .reverse()
                .find(m => m.sender === 'user');
              
              if (ultimaMensagemDoUsuario) {
                const tempoUltimaMsgUsuario = ultimaMensagemDoUsuario.timestamp instanceof Date 
                  ? ultimaMensagemDoUsuario.timestamp.getTime() 
                  : new Date(ultimaMensagemDoUsuario.timestamp).getTime();
                
                // ⚡ CORREÇÃO: Apenas verificar se o usuário respondeu recentemente
                // Não precisa que o contato também tenha respondido recentemente
                const usuarioRespondeuRecentemente = (agora - tempoUltimaMsgUsuario) < TEMPO_CONVERSA_AO_VIVO;
                
                if (usuarioRespondeuRecentemente) {
                  statusConversa = "answered"; // Manter em "Em Atendimento"
                } else {
                  statusConversa = "waiting"; // Usuário não respondeu - aguardando
                }
              } else {
                statusConversa = "waiting"; // Sem resposta do usuário
              }
            }
          }

          // Buscar usuário responsável (última mensagem com assigned_user_id)
          const assignedUserId = mensagens.find(m => m.assigned_user_id)?.assigned_user_id;
          const assignedUser = assignedUserId ? usersMap.get(assignedUserId) : undefined;

          // 🔥 NOVO: Detectar origem da API (Meta ou Evolution)
          // Usar a origem da última mensagem recebida (não enviada)
          const ultimaMensagemRecebida = mensagens.find(m => {
            const isFromMe = m.fromme === true || String(m.fromme) === 'true';
            return !isFromMe && m.origem_api;
          });
          const origemApi = ultimaMensagemRecebida?.origem_api || 
                           mensagens.find(m => m.origem_api)?.origem_api || 
                           'evolution';

          // Avatar: usar foto do lead se disponível, com fallback por canal
          const avatarUrl = leadInfo?.profilePictureUrl 
            ? leadInfo.profilePictureUrl
            : isInstagramConversation
              ? `https://ui-avatars.com/api/?name=${encodeURIComponent(contactName)}&background=E1306C&color=fff`
              : undefined;

          return {
            id: leadInfo?.leadId || `conv-${telefone}`,
            contactName,
            channel: isInstagramConversation ? "instagram" as const : isMessengerConversation ? "facebook" as const : "whatsapp" as const,
            status: statusConversa,
            lastMessage: ultimaMensagem?.content || '',
            unread: 0,
            messages: messagensFormatadas,
            tags: [],
            phoneNumber: telefone,
            isGroup,
            avatarUrl,
            assignedUser,
            origemApi: origemApi as "evolution" | "meta",
          };
        });

      setLoadingConversations(false);
      // ⚡ OTIMIZAÇÃO: Habilitar paginação se houver mais conversas
      setHasMoreConversations(conversasData.length >= MESSAGES_TO_FETCH);

      // 📸 [INSTAGRAM] Resolver nomes placeholder em background via edge function
      try {
        const placeholderRegex = /^(Contato\s+Instagram|Instagram\s+\d+)$/i;
        const igPlaceholders = novasConversas.filter(c =>
          c.channel === 'instagram' && placeholderRegex.test(String(c.contactName || '').trim())
        );
        if (igPlaceholders.length > 0) {
          console.log(`📸 [LOAD] Disparando resolve-instagram-name para ${igPlaceholders.length} conversas`);
          // Não bloqueia o carregamento — fire-and-forget com pequeno escalonamento
          igPlaceholders.slice(0, 25).forEach((conv, idx) => {
            const igUserId = String(conv.phoneNumber || '').replace(/^ig_/, '').replace(/[^0-9]/g, '');
            if (!igUserId || igUserId.length < 10) return;
            setTimeout(() => {
              supabase.functions.invoke('resolve-instagram-name', {
                body: { company_id: userCompanyId, instagram_user_id: igUserId },
              }).catch(() => {});
            }, idx * 250);
          });
        }
      } catch (e) {
        console.warn('📸 [LOAD] Falha ao agendar resolve-instagram-name:', e);
      }

      console.log(`✅ [LOAD] ${novasConversas.length} conversas carregadas (${conversasData.length} mensagens processadas)`);
      return novasConversas;
    } catch (error) {
      console.error('❌ Erro ao carregar conversas:', error);
      setLoadingConversations(false);
      return [];
    }
  }, []);

  return {
    conversationsLimit,
    conversationsOffset,
    hasMoreConversations,
    loadingMore,
    loadingConversations,
    setConversationsLimit,
    setConversationsOffset,
    setHasMoreConversations,
    setLoadingMore,
    loadInitialConversations,
  };
};
