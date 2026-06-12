import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Shield } from "lucide-react";

interface Permission {
  id: string;
  name: string;
  module: string;
  action: string;
  description: string | null;
}

interface UserPermission {
  permission_id: string;
  granted: boolean;
}

interface PermissoesUsuarioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
  userName: string;
  companyId: string;
  onSuccess?: () => void;
}

// Mapeamento de módulos para labels amigáveis
const moduleLabels: Record<string, string> = {
  analytics: "Analytics",
  leads: "Leads",
  conversas: "Conversas",
  agenda: "Agenda",
  funil: "Funil de Vendas",
  tarefas: "Tarefas",
  relatorios: "Relatórios",
  configuracoes: "Configurações",
  fluxos: "Fluxos de Automação",
  automacao: "Automação e IA",
  usuarios: "Usuários",
  chat_equipe: "Chat da Equipe",
  reunioes: "Reuniões",
  discador: "Call Center",
  processos: "BPO Comercial",
};

// Mapeamento de ações para labels amigáveis
const actionLabels: Record<string, string> = {
  view: "Visualizar",
  create: "Criar",
  edit: "Editar",
  delete: "Excluir",
  send: "Enviar",
  manage: "Gerenciar",
  call: "Realizar Chamadas",
};

export function PermissoesUsuarioDialog({
  open,
  onOpenChange,
  userId,
  userName,
  companyId,
  onSuccess,
}: PermissoesUsuarioDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [userPermissions, setUserPermissions] = useState<Map<string, boolean>>(new Map());
  const [originalPermissions, setOriginalPermissions] = useState<Map<string, boolean>>(new Map());

  useEffect(() => {
    if (open && userId) {
      loadPermissions();
    }
  }, [open, userId]);

  const loadPermissions = async () => {
    if (!userId) return;
    
    setLoading(true);
    try {
      // Carregar todas as permissões disponíveis
      const { data: allPermissions, error: permError } = await supabase
        .from('permissions')
        .select('*')
        .order('module', { ascending: true });

      if (permError) throw permError;
      setPermissions(allPermissions || []);

      // Carregar permissões do usuário
      const { data: userPerms, error: userPermsError } = await supabase
        .from('user_permissions')
        .select('permission_id, granted')
        .eq('user_id', userId)
        .eq('company_id', companyId);

      if (userPermsError) throw userPermsError;

      // Criar mapa de permissões do usuário
      const permsMap = new Map<string, boolean>();
      (userPerms || []).forEach((up: UserPermission) => {
        permsMap.set(up.permission_id, up.granted);
      });
      
      setUserPermissions(permsMap);
      setOriginalPermissions(new Map(permsMap));
    } catch (error: any) {
      console.error('Erro ao carregar permissões:', error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível carregar as permissões",
      });
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = (permissionId: string) => {
    setUserPermissions(prev => {
      const newMap = new Map(prev);
      const currentValue = newMap.get(permissionId);
      if (currentValue === undefined) {
        newMap.set(permissionId, true);
      } else {
        newMap.set(permissionId, !currentValue);
      }
      return newMap;
    });
  };

  const handleSave = async () => {
    if (!userId) return;

    setSaving(true);
    try {
      // Encontrar permissões que mudaram
      const toInsert: { user_id: string; permission_id: string; company_id: string; granted: boolean }[] = [];
      const toUpdate: { permission_id: string; granted: boolean }[] = [];
      const toDelete: string[] = [];

      userPermissions.forEach((granted, permissionId) => {
        const originalValue = originalPermissions.get(permissionId);
        
        if (originalValue === undefined) {
          // Nova permissão
          toInsert.push({
            user_id: userId,
            permission_id: permissionId,
            company_id: companyId,
            granted,
          });
        } else if (originalValue !== granted) {
          // Permissão atualizada
          toUpdate.push({ permission_id: permissionId, granted });
        }
      });

      // Verificar permissões removidas
      originalPermissions.forEach((_, permissionId) => {
        if (!userPermissions.has(permissionId)) {
          toDelete.push(permissionId);
        }
      });

      // Executar operações
      if (toInsert.length > 0) {
        const { error } = await supabase
          .from('user_permissions')
          .insert(toInsert);
        if (error) throw error;
      }

      for (const item of toUpdate) {
        const { error } = await supabase
          .from('user_permissions')
          .update({ granted: item.granted, updated_at: new Date().toISOString() })
          .eq('user_id', userId)
          .eq('permission_id', item.permission_id)
          .eq('company_id', companyId);
        if (error) throw error;
      }

      if (toDelete.length > 0) {
        const { error } = await supabase
          .from('user_permissions')
          .delete()
          .eq('user_id', userId)
          .eq('company_id', companyId)
          .in('permission_id', toDelete);
        if (error) throw error;
      }

      toast({
        title: "Sucesso",
        description: "Permissões atualizadas com sucesso",
      });

      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Erro ao salvar permissões:', error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message || "Não foi possível salvar as permissões",
      });
    } finally {
      setSaving(false);
    }
  };

  // Agrupar permissões por módulo
  const groupedPermissions = permissions.reduce((acc, perm) => {
    if (!acc[perm.module]) {
      acc[perm.module] = [];
    }
    acc[perm.module].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  const selectAllModule = (module: string) => {
    const modulePerms = groupedPermissions[module] || [];
    const allSelected = modulePerms.every(p => userPermissions.get(p.id) === true);
    
    setUserPermissions(prev => {
      const newMap = new Map(prev);
      modulePerms.forEach(p => {
        newMap.set(p.id, !allSelected);
      });
      return newMap;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Permissões de Acesso
          </DialogTitle>
          <DialogDescription>
            Configure as permissões de acesso para <strong>{userName}</strong>
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="overflow-y-auto max-h-[60vh] pr-2">
            <div className="space-y-6 pb-4">
              {Object.entries(groupedPermissions).map(([module, perms]) => (
                <div key={module} className="space-y-3">
                  <div className="flex items-center justify-between sticky top-0 bg-background py-2 z-10">
                    <h4 className="font-semibold text-sm">
                      {moduleLabels[module] || module}
                    </h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => selectAllModule(module)}
                      className="h-7 text-xs"
                    >
                      {perms.every(p => userPermissions.get(p.id) === true) 
                        ? "Desmarcar todos" 
                        : "Selecionar todos"}
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {perms.map((perm) => (
                      <div
                        key={perm.id}
                        className="flex items-start space-x-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                      >
                        <Checkbox
                          id={perm.id}
                          checked={userPermissions.get(perm.id) === true}
                          onCheckedChange={() => togglePermission(perm.id)}
                        />
                        <div className="flex-1 space-y-1">
                          <Label
                            htmlFor={perm.id}
                            className="text-sm font-medium cursor-pointer"
                          >
                            {actionLabels[perm.action] || perm.action}
                          </Label>
                          {perm.description && (
                            <p className="text-xs text-muted-foreground">
                              {perm.description}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar Permissões
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
