import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface SystemUpdateChange {
  type: 'feature' | 'improvement' | 'fix';
  icon?: string;
  text: string;
}

export interface SystemUpdate {
  id: string;
  master_company_id: string;
  version: string;
  title: string;
  description: string | null;
  changes: SystemUpdateChange[];
  tipo: 'feature' | 'fix' | 'improvement';
  module: string | null;
  published_at: string;
  created_by: string | null;
  created_at: string;
  is_read?: boolean;
}

export function useSystemUpdates() {
  const [updates, setUpdates] = useState<SystemUpdate[]>([]);
  const [unreadUpdates, setUnreadUpdates] = useState<SystemUpdate[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [masterCompanyId, setMasterCompanyId] = useState<string | null>(null);
  const { toast } = useToast();

  const checkUserRole = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userRole } = await supabase.rpc('get_my_user_role');
      const role = Array.isArray(userRole) ? userRole[0] : userRole;
      
      if (role) {
        setIsSuperAdmin(role.role === 'super_admin');
        setMasterCompanyId(role.company_id);
      }
    } catch (error) {
      console.error('Erro ao verificar role do usuário:', error);
    }
  }, []);

  const loadUpdates = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Buscar atualizações
      const { data: updatesData, error } = await supabase
        .from('system_updates')
        .select('*')
        .order('published_at', { ascending: false });

      if (error) {
        console.error('Erro ao carregar atualizações:', error);
        setLoading(false);
        return;
      }

      // Buscar leituras do usuário
      const { data: readsData } = await supabase
        .from('system_update_reads')
        .select('update_id')
        .eq('user_id', user.id);

      const readIds = new Set(readsData?.map(r => r.update_id) || []);

      // Processar atualizações com status de leitura
      const processedUpdates: SystemUpdate[] = (updatesData || []).map(update => ({
        id: update.id,
        master_company_id: update.master_company_id,
        version: update.version,
        title: update.title,
        description: update.description,
        changes: (Array.isArray(update.changes) ? update.changes : []) as unknown as SystemUpdateChange[],
        tipo: update.tipo as 'feature' | 'fix' | 'improvement',
        module: (update as any).module ?? null,
        published_at: update.published_at,
        created_by: update.created_by,
        created_at: update.created_at,
        is_read: readIds.has(update.id),
      }));

      setUpdates(processedUpdates);
      setUnreadUpdates(processedUpdates.filter(u => !u.is_read));
      console.log('📢 [ATUALIZAÇÕES] Carregadas:', processedUpdates.length, '| Não lidas:', processedUpdates.filter(u => !u.is_read).length);
    } catch (error) {
      console.error('Erro ao carregar atualizações:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const markAsRead = useCallback(async (updateId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userRole } = await supabase.rpc('get_my_user_role');
      const role = Array.isArray(userRole) ? userRole[0] : userRole;

      const { error } = await supabase
        .from('system_update_reads')
        .insert({
          update_id: updateId,
          user_id: user.id,
          company_id: role?.company_id || null,
        });

      if (error && !error.message.includes('duplicate')) {
        console.error('Erro ao marcar como lida:', error);
        return;
      }

      // Atualizar estado local
      setUpdates(prev => prev.map(u => 
        u.id === updateId ? { ...u, is_read: true } : u
      ));
      setUnreadUpdates(prev => prev.filter(u => u.id !== updateId));
    } catch (error) {
      console.error('Erro ao marcar atualização como lida:', error);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userRole } = await supabase.rpc('get_my_user_role');
      const role = Array.isArray(userRole) ? userRole[0] : userRole;

      // Inserir leituras para todas as atualizações não lidas
      const unreadIds = unreadUpdates.map(u => u.id);
      if (unreadIds.length === 0) return;

      const inserts = unreadIds.map(updateId => ({
        update_id: updateId,
        user_id: user.id,
        company_id: role?.company_id || null,
      }));

      await supabase
        .from('system_update_reads')
        .upsert(inserts, { onConflict: 'update_id,user_id' });

      // Atualizar estado local
      setUpdates(prev => prev.map(u => ({ ...u, is_read: true })));
      setUnreadUpdates([]);

      toast({
        title: "Atualizações",
        description: "Todas as atualizações foram marcadas como lidas",
      });
    } catch (error) {
      console.error('Erro ao marcar todas como lidas:', error);
    }
  }, [unreadUpdates, toast]);

  const createUpdate = useCallback(async (data: {
    version: string;
    title: string;
    description?: string;
    changes: SystemUpdateChange[];
    tipo: 'feature' | 'fix' | 'improvement';
    module?: string | null;
  }) => {
    try {
      if (!masterCompanyId) {
        throw new Error('Não foi possível identificar a empresa matriz');
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const insertData: any = {
        master_company_id: masterCompanyId,
        version: data.version,
        title: data.title,
        description: data.description || null,
        changes: data.changes as any,
        tipo: data.tipo,
        module: data.module || null,
        created_by: user.id,
      };

      const { error } = await supabase
        .from('system_updates')
        .insert(insertData);
      if (error) throw error;

      toast({
        title: "Atualização publicada!",
        description: "As subcontas serão notificadas sobre esta novidade.",
      });

      await loadUpdates();
      return true;
    } catch (error: any) {
      console.error('Erro ao criar atualização:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao publicar atualização',
        description: error.message,
      });
      return false;
    }
  }, [masterCompanyId, toast, loadUpdates]);

  const deleteUpdate = useCallback(async (updateId: string) => {
    try {
      const { error } = await supabase
        .from('system_updates')
        .delete()
        .eq('id', updateId);

      if (error) throw error;

      toast({
        title: "Atualização removida",
        description: "A atualização foi removida com sucesso.",
      });

      await loadUpdates();
      return true;
    } catch (error: any) {
      console.error('Erro ao deletar atualização:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao remover atualização',
        description: error.message,
      });
      return false;
    }
  }, [toast, loadUpdates]);

  useEffect(() => {
    checkUserRole();
    loadUpdates();
  }, [checkUserRole, loadUpdates]);

  return {
    updates,
    unreadUpdates,
    unreadCount: unreadUpdates.length,
    loading,
    isSuperAdmin,
    masterCompanyId,
    markAsRead,
    markAllAsRead,
    createUpdate,
    deleteUpdate,
    refresh: loadUpdates,
  };
}
