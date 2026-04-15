import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * ✨ MELHORIA 100%: Hook para cache persistente de conversas
 * 
 * Funcionalidades:
 * - Cache em localStorage com TTL de 30 minutos
 * - Carregamento instantâneo do cache + sincronização em segundo plano
 * - Histórico completo (até 2000 mensagens)
 * - Isolamento por empresa (company_id)
 */

export interface Message {
  id: string;
  content: string;
  type: "text" | "image" | "audio" | "pdf" | "video" | "contact" | "document";
  sender: "user" | "contact";
  timestamp: Date;
  delivered: boolean;
  read?: boolean;
  mediaUrl?: string;
  fileName?: string;
  sentBy?: string; // ⚡ Nome do usuário que enviou a mensagem
}

export interface Conversation {
  id: string;
  contactName: string;
  channel: "whatsapp" | "instagram" | "facebook";
  status: "waiting" | "answered" | "resolved";
  lastMessage: string;
  unread: number;
  messages: Message[];
  tags: string[];
  phoneNumber?: string;
  isGroup?: boolean;
  avatarUrl?: string; // ⚡ Foto de perfil
  origemApi?: "evolution" | "meta"; // 🔥 NOVO: Identificação da API de origem
  // 🆕 Dados do lead vinculado
  funnelStage?: string;
  valor?: string;
  responsavel?: string;
  leadId?: string;
  assignedUser?: {
    id: string;
    name: string;
    avatar?: string;
  };
}

interface CacheData {
  timestamp: number;
  conversations: Conversation[];
  companyId: string;
}

const CACHE_KEY = 'conversas_cache_v3'; // ⚡ v3: Melhorias de sincronização
const CACHE_TTL = 30 * 60 * 1000; // 30 minutos

export const useConversationsCache = (companyId: string | null) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSync, setLastSync] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState(false); // ✅ FASE 3: Flag de sincronização

  // ⚡ FASE 1: Carregar imediatamente do cache quando companyId estiver disponível
  useEffect(() => {
    if (!companyId) {
      setIsLoading(false);
      return;
    }

    console.log('⚡ [CACHE] Company ID disponível, carregando cache:', companyId);
    const cached = loadFromCache();
    
    if (cached && cached.length > 0) {
      console.log(`💾 [CACHE] ${cached.length} conversas carregadas instantaneamente`);
      setConversations(cached);
      setLastSync(Date.now());
    }
    
    setIsLoading(false);
  }, [companyId]);

  // ⚡ FASE 2.2: Carregar do cache persistente
  const loadFromCache = useCallback((): Conversation[] | null => {
    if (!companyId) return null;

    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return null;

      const data: CacheData = JSON.parse(cached);
      
      // Validar empresa
      if (data.companyId !== companyId) {
        console.log('⚠️ [CACHE] Cache de outra empresa, ignorando');
        localStorage.removeItem(CACHE_KEY);
        return null;
      }

      // Validar TTL
      const age = Date.now() - data.timestamp;
      if (age > CACHE_TTL) {
        console.log('⏰ [CACHE] Cache expirado, removendo');
        localStorage.removeItem(CACHE_KEY);
        return null;
      }

      console.log(`💾 [CACHE] Cache válido (idade: ${Math.round(age / 1000)}s)`);
      
      // Converter timestamps
      const conversationsWithDates = data.conversations.map(conv => ({
        ...conv,
        messages: conv.messages.map(msg => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }))
      }));

      return conversationsWithDates;
    } catch (error) {
      console.error('❌ [CACHE] Erro ao carregar:', error);
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
  }, [companyId]);

  // 💾 Salvar no cache
  const saveToCache = useCallback((convs: Conversation[]) => {
    if (!companyId) return;

    try {
      const data: CacheData = {
        timestamp: Date.now(),
        conversations: convs,
        companyId
      };

      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      console.log(`💾 [CACHE] ${convs.length} conversas salvas`);
    } catch (error) {
      console.error('❌ [CACHE] Erro ao salvar:', error);
      localStorage.removeItem(CACHE_KEY);
    }
  }, [companyId]);

  // 📡 FASE 2.1: Carregar do banco (otimizado) - CORRIGIDO para buscar TODAS as conversas
  const loadFromDatabase = useCallback(async (): Promise<Conversation[]> => {
    if (!companyId) return [];

    try {
      console.log('📡 [DATABASE] Carregando histórico completo...');

      // ⚡ CORREÇÃO: Buscar TODAS as mensagens para garantir todas as conversas únicas
      // Usar paginação para buscar mais dados sem timeout
      let allConversasData: any[] = [];
      let offset = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data: batch, error } = await supabase
          .from('conversas')
          .select('id, numero, telefone_formatado, mensagem, nome_contato, tipo_mensagem, status, created_at, is_group, fromme, arquivo_nome, sent_by, owner_id, midia_url, origem, origem_api')
          .eq('company_id', companyId)
          .order('created_at', { ascending: false })
          .range(offset, offset + batchSize - 1);

        if (error) throw error;

        if (batch && batch.length > 0) {
          allConversasData = [...allConversasData, ...batch];
          offset += batchSize;
          hasMore = batch.length === batchSize;
          console.log(`📊 [DATABASE] Batch carregado: ${batch.length} mensagens (total: ${allConversasData.length})`);
        } else {
          hasMore = false;
        }

        // Limite de segurança: máximo 10.000 mensagens
        if (allConversasData.length >= 10000) {
          console.warn('⚠️ [DATABASE] Limite de 10.000 mensagens atingido');
          hasMore = false;
        }
      }

      console.log(`📊 [DATABASE] ${allConversasData.length} mensagens totais carregadas`);

      // Validar e filtrar
      const validConversas = allConversasData.filter(conv => 
        conv.numero && !conv.numero.includes('{{') &&
        conv.mensagem && !conv.mensagem.includes('{{')
      );

      console.log(`✅ [DATABASE] ${validConversas.length} mensagens válidas`);

      // ⚡ FASE 2.2: Buscar nomes dos usuários baseado nos owner_id (ANTES de processar mensagens)
      const ownerIdsSet = new Set<string>();
      validConversas.forEach(conv => {
        if (conv.owner_id && (conv.fromme === true || conv.status === 'Enviada')) {
          ownerIdsSet.add(conv.owner_id);
        }
      });
      
      const ownerNamesMap = new Map<string, string>();
      if (ownerIdsSet.size > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', Array.from(ownerIdsSet));
        
        if (profilesData) {
          profilesData.forEach(profile => {
            ownerNamesMap.set(profile.id, profile.full_name || profile.email || 'Usuário');
          });
        }
        console.log(`👥 [DATABASE] ${ownerNamesMap.size} nomes de usuários carregados`);
      }

      // ⚡ FASE 2.3: Agrupar APENAS por identificador da conversa (telefone, grupo ou Instagram)
      const conversasMap = new Map<string, any[]>();
      validConversas.forEach(conv => {
        const isGroup = conv.is_group || /@g\.us$/.test(conv.numero || '');
        const normalizedDigits = String(conv.telefone_formatado || conv.numero || '').replace(/[^0-9]/g, '');
        const isInstagram = conv.origem === 'Instagram' || (conv.origem_api === 'meta' && normalizedDigits.length >= 15);

        const key = isGroup
          ? String(conv.numero || '')
          : isInstagram
            ? `ig_${normalizedDigits}`
            : (normalizedDigits || String(conv.numero || '').replace(/[^0-9]/g, ''));

        if (!conversasMap.has(key)) {
          conversasMap.set(key, []);
        }
        conversasMap.get(key)!.push(conv);
      });

      console.log(`📊 [DATABASE] ${conversasMap.size} conversas únicas`);

      // 🆕 FASE 2.4: Buscar leads vinculados para todas as conversas
      const allPhones = Array.from(conversasMap.keys());
      const leadsMap = new Map<string, any>();
      const responsaveisMap = new Map<string, any[]>();
      
      if (allPhones.length > 0) {
        try {
          // Buscar leads pelo telefone
          const { data: leadsData } = await supabase
            .from('leads')
            .select(`
              id, phone, name, value, tags, status, profile_picture_url,
              etapa_id, funil_id, responsaveis, responsavel_id,
              etapas:etapa_id(nome),
              funis:funil_id(nome)
            `)
            .eq('company_id', companyId);
          
          if (leadsData) {
            // Mapear leads por telefone normalizado
            leadsData.forEach(lead => {
              if (lead.phone) {
                const normalizedPhone = lead.phone.replace(/[^0-9]/g, '');
                leadsMap.set(normalizedPhone, lead);
                // Também mapear com formato completo
                leadsMap.set(lead.phone, lead);
              }
            });
            console.log(`👤 [DATABASE] ${leadsData.length} leads carregados`);
            
            // Buscar nomes dos responsáveis
            const allResponsaveisIds = new Set<string>();
            leadsData.forEach(lead => {
              if (lead.responsaveis && Array.isArray(lead.responsaveis)) {
                lead.responsaveis.forEach((id: string) => allResponsaveisIds.add(id));
              }
              if (lead.responsavel_id) {
                allResponsaveisIds.add(lead.responsavel_id);
              }
            });
            
            if (allResponsaveisIds.size > 0) {
              const { data: responsaveisProfiles } = await supabase
                .from('profiles')
                .select('id, full_name, email')
                .in('id', Array.from(allResponsaveisIds));
              
              if (responsaveisProfiles) {
                const profilesById = new Map(responsaveisProfiles.map(p => [p.id, p]));
                
                leadsData.forEach(lead => {
                  if (lead.phone) {
                    const normalizedPhone = lead.phone.replace(/[^0-9]/g, '');
                    const responsaveisIds = lead.responsaveis || (lead.responsavel_id ? [lead.responsavel_id] : []);
                    const responsaveisNames = responsaveisIds
                      .map((id: string) => profilesById.get(id))
                      .filter(Boolean)
                      .map((p: any) => p.full_name || p.email);
                    
                    if (responsaveisNames.length > 0) {
                      responsaveisMap.set(normalizedPhone, responsaveisNames);
                      responsaveisMap.set(lead.phone, responsaveisNames);
                    }
                  }
                });
                console.log(`👥 [DATABASE] ${responsaveisMap.size} responsáveis mapeados`);
              }
            }
          }
        } catch (error) {
          console.error('⚠️ [DATABASE] Erro ao buscar leads:', error);
        }
      }

      // Converter para formato Conversation
      const conversations: Conversation[] = Array.from(conversasMap.entries()).map(([telefone, mensagens]) => {
        // ⚡ OTIMIZAÇÃO: Deduplicar apenas por ID (mais rápido)
        const mensagensDeduplicadas = Array.from(new Map(mensagens.map(m => [m.id, m])).values());
        
        // ⚡ Últimas 100 mensagens por conversa (otimização)
        const mensagensOrdenadas = mensagensDeduplicadas
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        
        const mensagensRecentes = mensagensOrdenadas.slice(-100);
        
        const messagensFormatadas: Message[] = mensagensRecentes
          .map(m => {
            const isFromMe = m.fromme === true || m.status === 'Enviada';
            // ⚡ CORREÇÃO DEFINITIVA: Usar sent_by do banco, com fallback pelo owner_id
            // 1. Primeiro, tenta usar sent_by do banco (já salvo permanentemente)
            // 2. Se não tiver sent_by, busca pelo owner_id no ownerNamesMap
            // 3. Se nenhum funcionar e for mensagem enviada, usa "Equipe"
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
              sentBy: sentBy, // ⚡ CORREÇÃO: Incluir assinatura do banco com fallback
            };
          });

        const isGroup = mensagens[0]?.is_group || /@g\.us$/.test(telefone);
        const isInstagramConversation = telefone.startsWith('ig_') || mensagens.some(m => {
          const digits = String(m.telefone_formatado || m.numero || '').replace(/[^0-9]/g, '');
          return m.origem === 'Instagram' || (m.origem_api === 'meta' && digits.length >= 15);
        });

        const isInstagramPlaceholderName = (value?: string | null): boolean => {
          const name = String(value ?? '').trim();
          if (!name) return true;
          if (/^Contato\s+Instagram$/i.test(name)) return true;
          if (/^Instagram\s+\d+$/i.test(name)) return true;
          if (/^\d{10,}$/.test(name.replace(/^ig_/, ''))) return true;
          return false;
        };

        const bestNamedMessage = isInstagramConversation
          ? mensagens.find(m => {
              const name = String(m.nome_contato ?? '').trim();
              return name && !isInstagramPlaceholderName(name);
            })
          : mensagens.find(m => String(m.nome_contato ?? '').trim());

        const contactName = bestNamedMessage?.nome_contato
          || (isInstagramConversation ? 'Contato Instagram' : telefone);
         
        const ultimaMensagem = messagensFormatadas[messagensFormatadas.length - 1];
         
        let statusConversa: "waiting" | "answered" | "resolved" = "waiting";
        const temMensagemResolvida = mensagens.some(m => m.status === 'Resolvida' || m.status === 'Finalizada');
        if (temMensagemResolvida) {
          statusConversa = "resolved";
        } else if (ultimaMensagem?.sender === 'user') {
          statusConversa = "answered";
        } else if (ultimaMensagem) {
          // ⚡ MELHORIA: Verificar se é conversa "ao vivo" (interação recente)
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

        // ⚡ Avatar - usar foto do lead se disponível, senão placeholder
        const normalizedPhoneForAvatar = telefone.replace(/^ig_/, '').replace(/[^0-9]/g, '');
        const leadForAvatar = leadsMap.get(normalizedPhoneForAvatar) || leadsMap.get(telefone);
        const leadProfilePic = leadForAvatar?.profile_picture_url;
        
        const avatarUrl = leadProfilePic
          ? leadProfilePic
          : isGroup
            ? `https://ui-avatars.com/api/?name=${encodeURIComponent(contactName)}&background=10b981&color=fff`
            : isInstagramConversation
              ? `https://ui-avatars.com/api/?name=${encodeURIComponent(contactName)}&background=E1306C&color=fff`
              : `https://ui-avatars.com/api/?name=${encodeURIComponent(contactName)}&background=0ea5e9&color=fff`;

        // 🆕 Buscar dados do lead vinculado
        const normalizedPhone = telefone.replace(/^ig_/, '').replace(/[^0-9]/g, '');
        const lead = leadsMap.get(normalizedPhone) || leadsMap.get(telefone);
        const responsaveis = responsaveisMap.get(normalizedPhone) || responsaveisMap.get(telefone) || [];
        
        // Formatar valor
        let valorFormatado = '';
        if (lead?.value) {
          valorFormatado = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(lead.value);
        }
        
        // Nome da etapa do funil
        const funnelStage = (lead?.etapas as any)?.nome || undefined;
        
        return {
          id: telefone,
          contactName,
          channel: isInstagramConversation ? "instagram" as const : "whatsapp" as const,
          status: statusConversa,
          lastMessage: ultimaMensagem?.content || '',
          unread: 0,
          messages: messagensFormatadas,
          tags: lead?.tags || [],
          phoneNumber: telefone,
          isGroup,
          avatarUrl,
          // 🆕 Dados do lead
          leadId: lead?.id,
          funnelStage,
          valor: valorFormatado || undefined,
          responsavel: responsaveis.join(', ') || undefined,
          assignedUser: responsaveis.length > 0 ? {
            id: lead?.responsavel_id || '',
            name: responsaveis[0],
          } : undefined,
        };
      });

      return conversations;
    } catch (error: any) {
      console.error('❌ [DATABASE] Erro:', {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code
      });
      
      // Não mostrar toast se for erro de JSON parsing (dados corrompidos)
      if (!error?.message?.includes('JSON')) {
        toast.error('Erro ao carregar conversas');
      }
      
      return [];
    }
  }, [companyId]);

  // 🔄 Sincronizar: cache → banco (background)
  // ✅ FASE 2 & 3: Melhorias de sincronização multi-usuário
  const syncConversations = useCallback(async (forceRefresh: boolean = false) => {
    if (!companyId) {
      console.log('⏳ [SYNC] Aguardando companyId...');
      return;
    }

    // ✅ FASE 3: Evitar sincronizações simultâneas
    if (isSyncing && !forceRefresh) {
      console.log('⏳ [SYNC] Sincronização já em andamento, ignorando...');
      return;
    }

    setIsLoading(true);
    setIsSyncing(true);

    try {
      // 1️⃣ Tentar cache primeiro (carregamento instantâneo)
      if (!forceRefresh) {
        const cached = loadFromCache();
        if (cached && cached.length > 0) {
          console.log(`✅ [SYNC] ${cached.length} conversas do cache (instantâneo)`);
          setConversations(cached);
          setIsLoading(false);
          setLastSync(Date.now());
          
          // 2️⃣ ✅ FASE 3: Atualizar em segundo plano (delay reduzido de 1000ms para 500ms)
          setTimeout(async () => {
            console.log('🔄 [SYNC] Atualizando em segundo plano...');
            const fresh = await loadFromDatabase();
            if (fresh.length > 0) {
              console.log(`✅ [SYNC] ${fresh.length} conversas atualizadas`);
              // ⚡ CORREÇÃO: Preservar avatarUrls já carregados
              setConversations(prev => {
                const avatarMap = new Map<string, string>();
                prev.forEach(c => {
                  if (c.avatarUrl && !c.avatarUrl.includes('ui-avatars.com')) {
                    avatarMap.set(c.id, c.avatarUrl);
                  }
                });
                
                const merged = fresh.map(c => ({
                  ...c,
                  avatarUrl: avatarMap.get(c.id) || c.avatarUrl
                }));
                
                saveToCache(merged);
                return merged;
              });
              setLastSync(Date.now());
            }
            setIsSyncing(false);
          }, 500); // ✅ FASE 3: Delay reduzido para 500ms
          
          return;
        }
      }

      // 3️⃣ Sem cache ou forçou refresh: buscar do banco
      console.log('📡 [SYNC] Carregando do banco...');
      const fresh = await loadFromDatabase();
      console.log(`✅ [SYNC] ${fresh.length} conversas carregadas`);
      // ⚡ CORREÇÃO: Preservar avatarUrls já carregados ao forçar refresh
      setConversations(prev => {
        const avatarMap = new Map<string, string>();
        prev.forEach(c => {
          if (c.avatarUrl && !c.avatarUrl.includes('ui-avatars.com')) {
            avatarMap.set(c.id, c.avatarUrl);
          }
        });
        
        const merged = fresh.map(c => ({
          ...c,
          avatarUrl: avatarMap.get(c.id) || c.avatarUrl
        }));
        
        saveToCache(merged);
        return merged;
      });
      setLastSync(Date.now());
    } catch (error) {
      console.error('❌ [SYNC] Erro:', error);
      toast.error('Erro ao sincronizar conversas');
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  }, [companyId, loadFromCache, loadFromDatabase, saveToCache, isSyncing]);

  // ⚡ REMOVIDO: Auto-sync automático para evitar loop infinito
  // O componente Conversas.tsx controla quando carregar
  // useEffect(() => {
  //   if (companyId) {
  //     syncConversations();
  //   }
  // }, [companyId]);

  // 🔄 Atualizar conversa específica
  const updateConversation = useCallback((updatedConv: Conversation) => {
    setConversations(prev => {
      const newConvs = prev.map(c => c.id === updatedConv.id ? updatedConv : c);
      saveToCache(newConvs);
      return newConvs;
    });
  }, [saveToCache]);

  // ➕ Adicionar mensagem
  const addMessage = useCallback((conversationId: string, message: Message) => {
    setConversations(prev => {
      const newConvs = prev.map(conv => {
        if (conv.id === conversationId) {
          return {
            ...conv,
            messages: [...conv.messages, message],
            lastMessage: message.content,
          };
        }
        return conv;
      });
      saveToCache(newConvs);
      return newConvs;
    });
  }, [saveToCache]);

  // 🗑️ Limpar cache
  const clearCache = useCallback(() => {
    localStorage.removeItem(CACHE_KEY);
    console.log('🗑️ [CACHE] Cache limpo');
  }, []);

  return {
    conversations,
    isLoading,
    isSyncing, // ✅ FASE 3: Expor flag de sincronização
    lastSync,
    syncConversations,
    updateConversation,
    addMessage,
    clearCache,
  };
};
