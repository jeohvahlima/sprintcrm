import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, UserPlus, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ResponsaveisManagerProps {
  leadId: string | null;
  responsaveisAtuais?: string[];
  onResponsaveisUpdated: (responsaveis: string[]) => void;
}

export function ResponsaveisManager({ 
  leadId, 
  responsaveisAtuais = [],
  onResponsaveisUpdated 
}: ResponsaveisManagerProps) {
  const [open, setOpen] = useState(false);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [novoResponsavel, setNovoResponsavel] = useState("");
  const [responsaveis, setResponsaveis] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);

  // Função para verificar se é UUID
  const isUUID = (str: string) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  };

  // Carregar responsáveis do banco quando leadId mudar
  useEffect(() => {
    const loadResponsaveisFromDB = async () => {
      if (!leadId) {
        // Sem leadId, usar responsaveisAtuais como fallback
        if (responsaveisAtuais && responsaveisAtuais.length > 0) {
          await convertToNames(responsaveisAtuais);
        } else {
          setResponsaveis([]);
        }
        return;
      }

      setInitialLoading(true);
      try {
        // Buscar responsáveis diretamente do lead no banco
        const { data: leadData, error } = await supabase
          .from("leads")
          .select("responsaveis, responsavel_id")
          .eq("id", leadId)
          .single();

        if (error) {
          console.error("Erro ao buscar responsáveis do lead:", error);
          // Fallback para responsaveisAtuais
          if (responsaveisAtuais && responsaveisAtuais.length > 0) {
            await convertToNames(responsaveisAtuais);
          }
          return;
        }

        // Usar responsaveis array, ou responsavel_id como fallback
        let uuidsToConvert: string[] = [];
        
        if (leadData?.responsaveis && Array.isArray(leadData.responsaveis) && leadData.responsaveis.length > 0) {
          uuidsToConvert = leadData.responsaveis as string[];
        } else if (leadData?.responsavel_id) {
          uuidsToConvert = [leadData.responsavel_id];
        }

        if (uuidsToConvert.length === 0) {
          setResponsaveis([]);
          return;
        }

        // Buscar nomes dos UUIDs
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', uuidsToConvert);

        if (profilesError) {
          console.error('Erro ao buscar perfis:', profilesError);
          setResponsaveis([]);
          return;
        }

        if (profiles && profiles.length > 0) {
          const convertedNames = uuidsToConvert.map(uuid => {
            const profile = profiles.find(p => p.id === uuid);
            // Nunca retornar UUID, usar fallback adequado
            return profile?.full_name || profile?.email || null;
          }).filter(Boolean) as string[];
          
          setResponsaveis(convertedNames);
          console.log('👥 Responsáveis carregados do banco:', convertedNames);
        } else {
          console.warn('⚠️ Nenhum perfil encontrado para UUIDs:', uuidsToConvert);
          setResponsaveis([]);
        }
      } catch (error) {
        console.error('Erro ao carregar responsáveis:', error);
      } finally {
        setInitialLoading(false);
      }
    };

    loadResponsaveisFromDB();
  }, [leadId]);

  // Função auxiliar para converter UUIDs para nomes
  const convertToNames = async (items: string[]) => {
    const uuids = items.filter(isUUID);
    const names = items.filter(r => !isUUID(r));

    // Se não há UUIDs, usar apenas os nomes
    if (uuids.length === 0) {
      setResponsaveis(names);
      return;
    }

    try {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', uuids);

      if (profiles && profiles.length > 0) {
        const convertedNames = uuids.map(uuid => {
          const profile = profiles.find(p => p.id === uuid);
          // Nunca retornar UUID, usar null se não encontrar
          return profile?.full_name || profile?.email || null;
        }).filter(Boolean) as string[];
        
        setResponsaveis([...names, ...convertedNames]);
      } else {
        // Se não encontrou perfis, usar apenas os nomes (sem UUIDs)
        setResponsaveis(names);
      }
    } catch (error) {
      console.error('Erro ao converter UUIDs para nomes:', error);
      // Em caso de erro, usar apenas os nomes (sem UUIDs)
      setResponsaveis(names);
    }
  };

  useEffect(() => {
    if (open) {
      carregarUsuarios();
    }
  }, [open]);

  const carregarUsuarios = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Buscar usuários da mesma empresa
      const { data: userRole } = await supabase
        .from("user_roles")
        .select("company_id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (!userRole?.company_id) return;

      // Buscar IDs dos usuários da empresa
      const { data: userRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("company_id", userRole.company_id);

      if (!userRoles || userRoles.length === 0) return;

      const userIds = userRoles.map(ur => ur.user_id);

      // Buscar perfis dos usuários
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in('id', userIds);

      if (profiles) {
        setUsuarios(profiles);
      }
    } catch (error) {
      console.error("Erro ao carregar usuários:", error);
    }
  };

  // Mapear nomes para UUIDs
  const getUUIDsFromNames = (names: string[]): string[] => {
    return names.map(name => {
      const usuario = usuarios.find(u => 
        (u.full_name || u.email) === name || u.id === name
      );
      return usuario?.id || name;
    }).filter(id => isUUID(id));
  };

  const adicionarResponsavel = async () => {
    if (!novoResponsavel) {
      toast.error("Selecione um responsável");
      return;
    }

    const usuario = usuarios.find(u => u.id === novoResponsavel);
    if (!usuario) return;

    const nomeResponsavel = usuario.full_name || usuario.email;

    if (responsaveis.includes(nomeResponsavel)) {
      toast.error("Este responsável já foi adicionado");
      return;
    }

    const novosResponsaveis = [...responsaveis, nomeResponsavel];
    setResponsaveis(novosResponsaveis);
    
    // Se tem leadId, salvar no banco - usar campo responsaveis (array de UUIDs)
    if (leadId) {
      setLoading(true);
      try {
        // Buscar responsáveis atuais do banco
        const { data: leadData } = await supabase
          .from("leads")
          .select("responsaveis")
          .eq("id", leadId)
          .single();

        const currentResponsaveis = (leadData?.responsaveis as string[]) || [];
        
        // Adicionar novo UUID se não existir
        if (!currentResponsaveis.includes(novoResponsavel)) {
          const updatedResponsaveis = [...currentResponsaveis, novoResponsavel];
          
          const { error } = await supabase
            .from("leads")
            .update({ 
              responsaveis: updatedResponsaveis,
              responsavel_id: updatedResponsaveis[0] // Manter primeiro como principal
            })
            .eq("id", leadId);

          if (error) throw error;
        }

        console.log('✅ Responsável adicionado:', nomeResponsavel, 'UUID:', novoResponsavel);
        toast.success(`${nomeResponsavel} adicionado como responsável`);
      } catch (error) {
        console.error("Erro ao salvar responsável:", error);
        toast.error("Erro ao adicionar responsável");
      } finally {
        setLoading(false);
      }
    }

    onResponsaveisUpdated(novosResponsaveis);
    setNovoResponsavel("");
    setOpen(false);
  };

  const removerResponsavel = async (nome: string) => {
    const novosResponsaveis = responsaveis.filter(r => r !== nome);
    setResponsaveis(novosResponsaveis);

    // Se tem leadId, salvar no banco
    if (leadId) {
      setLoading(true);
      try {
        // Buscar responsáveis atuais do banco
        const { data: leadData } = await supabase
          .from("leads")
          .select("responsaveis, responsavel_id")
          .eq("id", leadId)
          .single();

        const currentResponsaveis = (leadData?.responsaveis as string[]) || [];
        
        // Buscar o UUID correspondente ao nome
        let usuarioIdRemover: string | null = null;
        
        // Primeiro tentar encontrar na lista de usuários carregados
        const usuarioRemover = usuarios.find(u => 
          (u.full_name || u.email) === nome || u.id === nome
        );
        
        if (usuarioRemover) {
          usuarioIdRemover = usuarioRemover.id;
        } else {
          // Se não encontrou nos usuários carregados, buscar pelo nome no banco
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', currentResponsaveis);
          
          const profileMatch = profiles?.find(p => 
            p.full_name === nome || p.email === nome
          );
          
          usuarioIdRemover = profileMatch?.id || null;
        }

        if (usuarioIdRemover) {
          const updatedResponsaveis = currentResponsaveis.filter(id => id !== usuarioIdRemover);
          
          const { error } = await supabase
            .from("leads")
            .update({ 
              responsaveis: updatedResponsaveis,
              // Se o removido era o principal, atualizar para o próximo ou null
              responsavel_id: updatedResponsaveis.length > 0 
                ? updatedResponsaveis[0] 
                : (leadData?.responsavel_id === usuarioIdRemover ? null : leadData?.responsavel_id)
            })
            .eq("id", leadId);

          if (error) throw error;
          console.log('🗑️ Responsável removido:', nome, 'UUID:', usuarioIdRemover);
        } else {
          console.warn('⚠️ Não foi possível encontrar UUID para:', nome);
        }
        
        toast.success(`${nome} removido dos responsáveis`);
      } catch (error) {
        console.error("Erro ao remover responsável:", error);
        toast.error("Erro ao remover responsável");
      } finally {
        setLoading(false);
      }
    }

    onResponsaveisUpdated(novosResponsaveis);
  };

  return (
    <div>
      <h4 className="text-foreground font-medium mb-2 flex items-center gap-2">
        <Users className="h-4 w-4" /> 
        Responsáveis {responsaveis.length > 0 && `(${responsaveis.length})`}
        {initialLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      </h4>
      
      <div className="flex flex-wrap gap-2 mb-3 min-h-[40px]">
        {initialLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : responsaveis.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum responsável atribuído</p>
        ) : (
          responsaveis.map((nome, index) => (
            <Badge 
              key={`${nome}-${index}`} 
              variant="secondary"
              className="gap-2 py-1.5 pr-1"
            >
              <Avatar className="h-5 w-5">
                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                  {nome.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs">{nome}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-5 w-5 p-0 hover:bg-destructive/20 hover:text-destructive rounded-full"
                onClick={() => removerResponsavel(nome)}
                disabled={loading}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))
        )}
      </div>

      <Button
        size="sm"
        variant="outline"
        className="w-full"
        onClick={() => setOpen(v => !v)}
      >
        <UserPlus className="h-3 w-3 mr-2" />
        {open ? "Fechar" : "Adicionar Responsável"}
      </Button>

      {open && (
        <div className="mt-3 space-y-3 p-3 border border-border rounded-lg bg-muted/30">
          <p className="text-xs text-muted-foreground">
            Responsáveis podem visualizar e responder a conversa
          </p>
          <Select value={novoResponsavel} onValueChange={setNovoResponsavel}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Selecione um usuário" />
            </SelectTrigger>
            <SelectContent>
              {usuarios.map((usuario) => (
                <SelectItem key={usuario.id} value={usuario.id}>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {(usuario.full_name || usuario.email).charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{usuario.full_name || usuario.email}</p>
                      {usuario.full_name && (
                        <p className="text-xs text-muted-foreground">{usuario.email}</p>
                      )}
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} className="flex-1">
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={adicionarResponsavel}
              disabled={loading || !novoResponsavel}
              className="flex-1"
            >
              {loading ? "Adicionando..." : "Adicionar"}
            </Button>
          </div>
        </div>
      )}


      {responsaveis.length > 0 && (
        <p className="text-xs text-muted-foreground mt-2">
          💡 Todos podem visualizar e responder esta conversa
        </p>
      )}
    </div>
  );
}
