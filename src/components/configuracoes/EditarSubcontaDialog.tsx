import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Video, Phone, Target, Workflow } from "lucide-react";
import { SEGMENTOS_EMPRESA } from "@/lib/segmentos";

interface Company {
  id: string;
  name: string;
  cnpj: string | null;
  plan: string;
  max_users: number;
  max_leads: number;
  settings: any;
  segmento?: string | null;
  allow_chat_equipe?: boolean;
  allow_reunioes?: boolean;
  allow_discador?: boolean;
  allow_processos_comerciais?: boolean;
  allow_automacao?: boolean;
}

interface EditarSubcontaDialogProps {
  company: Company;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditarSubcontaDialog({ company, open, onOpenChange, onSuccess }: EditarSubcontaDialogProps) {
  const [loading, setLoading] = useState(false);
  const [showRedefinirSenha, setShowRedefinirSenha] = useState(false);
  const [novaSenha, setNovaSenha] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    cnpj: "",
    email: "",
    telefone: "",
    responsavel: "",
    segmento: "",
    plan: "basic",
    max_users: 5,
    max_leads: 1000,
  });
  const [modulosPremium, setModulosPremium] = useState({
    allow_chat_equipe: false,
    allow_reunioes: false,
    allow_discador: false,
    allow_processos_comerciais: false,
    allow_automacao: false,
  });
  const { toast } = useToast();

  useEffect(() => {
    if (company) {
      setFormData({
        name: company.name,
        cnpj: company.cnpj || "",
        email: company.settings?.email || "",
        telefone: company.settings?.telefone || "",
        responsavel: company.settings?.responsavel || "",
        segmento: company.segmento || "",
        plan: company.plan,
        max_users: company.max_users,
        max_leads: company.max_leads,
      });
      
      setModulosPremium({
        allow_chat_equipe: company.allow_chat_equipe || false,
        allow_reunioes: company.allow_reunioes || false,
        allow_discador: company.allow_discador || false,
        allow_processos_comerciais: company.allow_processos_comerciais || false,
        allow_automacao: company.allow_automacao || false,
      });
      
      // Buscar user_id do admin da empresa
      loadAdminUser();
    }
  }, [company]);

  const loadAdminUser = async () => {
    try {
      console.log('🔍 [EDITAR-SUBCONTA] Buscando admin da empresa:', company.id);
      
      // Buscar qualquer usuário da empresa (company_admin, gestor, etc)
      const { data, error } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .eq('company_id', company.id)
        .order('created_at', { ascending: true })
        .limit(1);
      
      if (error) {
        console.error('❌ [EDITAR-SUBCONTA] Erro ao buscar usuário:', error);
        return;
      }
      
      if (data && data.length > 0) {
        console.log('✅ [EDITAR-SUBCONTA] Usuário encontrado:', data[0]);
        setUserId(data[0].user_id);
      } else {
        console.warn('⚠️ [EDITAR-SUBCONTA] Nenhum usuário encontrado para empresa:', company.id);
      }
    } catch (error) {
      console.error('❌ [EDITAR-SUBCONTA] Erro ao buscar user_id:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from("companies")
        .update({
          name: formData.name,
          cnpj: formData.cnpj.trim() === '' ? null : formData.cnpj,
          plan: formData.plan,
          max_users: formData.max_users,
          max_leads: formData.max_leads,
          segmento: formData.segmento || null,
          settings: {
            email: formData.email,
            telefone: formData.telefone,
            responsavel: formData.responsavel,
          },
          // Módulos premium
          allow_chat_equipe: modulosPremium.allow_chat_equipe,
          allow_reunioes: modulosPremium.allow_reunioes,
          allow_discador: modulosPremium.allow_discador,
          allow_processos_comerciais: modulosPremium.allow_processos_comerciais,
          allow_automacao: modulosPremium.allow_automacao,
        })
        .eq("id", company.id);

      if (error) {
        console.error('❌ [EDITAR-SUBCONTA] Erro:', error);
        
        // Verificar se é erro de CNPJ duplicado
        if (error.message?.includes('companies_cnpj_key') || error.message?.includes('duplicate key')) {
          throw new Error(`O CNPJ ${formData.cnpj} já está cadastrado em outra empresa. Por favor, use outro CNPJ ou deixe em branco.`);
        }
        
        throw error;
      }

      toast({
        title: "Subconta atualizada",
        description: "As informações foram atualizadas com sucesso.",
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar subconta",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRedefinirSenha = async () => {
    if (!novaSenha || novaSenha.length < 6) {
      toast({
        title: "Erro",
        description: "A senha deve ter no mínimo 6 caracteres",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      console.log('🔐 [EDITAR-SUBCONTA] Redefinindo senha para empresa:', company.id, 'userId:', userId);
      
      const { data, error } = await supabase.functions.invoke('redefinir-senha-subconta', {
        body: {
          userId: userId || undefined,
          companyId: company.id,
          novaSenha,
          notificar: true,
          email: formData.email,
          telefone: formData.telefone,
          nome: formData.responsavel,
        },
      });

      if (error) {
        console.error('❌ [EDITAR-SUBCONTA] Erro da edge function:', error);
        throw error;
      }

      console.log('✅ [EDITAR-SUBCONTA] Senha redefinida com sucesso:', data);

      toast({
        title: "Senha redefinida",
        description: "A nova senha foi enviada por email e WhatsApp",
      });

      setShowRedefinirSenha(false);
      setNovaSenha("");
    } catch (error: any) {
      console.error('❌ [EDITAR-SUBCONTA] Erro ao redefinir senha:', error);
      
      toast({
        title: "Erro ao redefinir senha",
        description: error.message || "Não foi possível redefinir a senha. Verifique os logs do console.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar Subconta</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da Empresa *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input
                id="cnpj"
                value={formData.cnpj}
                onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone *</Label>
              <Input
                id="telefone"
                value={formData.telefone}
                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="responsavel">Responsável *</Label>
            <Input
              id="responsavel"
              value={formData.responsavel}
              onChange={(e) => setFormData({ ...formData, responsavel: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit_segmento">Segmento de Atuação</Label>
            <Select
              value={formData.segmento}
              onValueChange={(value) => setFormData({ ...formData, segmento: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o segmento" />
              </SelectTrigger>
              <SelectContent>
                {SEGMENTOS_EMPRESA.map((seg) => (
                  <SelectItem key={seg.value} value={seg.value}>
                    {seg.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="plan">Plano</Label>
              <Select
                value={formData.plan}
                onValueChange={(value) => setFormData({ ...formData, plan: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="basic">Padrão</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="max_users">Limite de Usuários</Label>
              <Input
                id="max_users"
                type="number"
                value={formData.max_users}
                onChange={(e) => setFormData({ ...formData, max_users: parseInt(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max_leads">Limite de Leads</Label>
              <Input
                id="max_leads"
                type="number"
                value={formData.max_leads}
                onChange={(e) => setFormData({ ...formData, max_leads: parseInt(e.target.value) })}
              />
            </div>
          </div>

          {/* Módulos Premium */}
          <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
            <Label className="text-sm font-semibold">Módulos Premium</Label>
            <p className="text-xs text-muted-foreground">
              Selecione os módulos que a subconta terá acesso
            </p>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="edit_allow_chat_equipe"
                  checked={modulosPremium.allow_chat_equipe}
                  onCheckedChange={(checked) => 
                    setModulosPremium({ ...modulosPremium, allow_chat_equipe: !!checked })
                  }
                />
                <label htmlFor="edit_allow_chat_equipe" className="text-sm flex items-center gap-1.5 cursor-pointer">
                  <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                  Chat Equipe
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="edit_allow_reunioes"
                  checked={modulosPremium.allow_reunioes}
                  onCheckedChange={(checked) => 
                    setModulosPremium({ ...modulosPremium, allow_reunioes: !!checked })
                  }
                />
                <label htmlFor="edit_allow_reunioes" className="text-sm flex items-center gap-1.5 cursor-pointer">
                  <Video className="h-3.5 w-3.5 text-muted-foreground" />
                  Reuniões
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="edit_allow_discador"
                  checked={modulosPremium.allow_discador}
                  onCheckedChange={(checked) => 
                    setModulosPremium({ ...modulosPremium, allow_discador: !!checked })
                  }
                />
                <label htmlFor="edit_allow_discador" className="text-sm flex items-center gap-1.5 cursor-pointer">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  Call Center
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="edit_allow_processos"
                  checked={modulosPremium.allow_processos_comerciais}
                  onCheckedChange={(checked) => 
                    setModulosPremium({ ...modulosPremium, allow_processos_comerciais: !!checked })
                  }
                />
                <label htmlFor="edit_allow_processos" className="text-sm flex items-center gap-1.5 cursor-pointer">
                  <Target className="h-3.5 w-3.5 text-muted-foreground" />
                  Gestão de Processos
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="edit_allow_automacao"
                  checked={modulosPremium.allow_automacao}
                  onCheckedChange={(checked) => 
                    setModulosPremium({ ...modulosPremium, allow_automacao: !!checked })
                  }
                />
                <label htmlFor="edit_allow_automacao" className="text-sm flex items-center gap-1.5 cursor-pointer">
                  <Workflow className="h-3.5 w-3.5 text-muted-foreground" />
                  Fluxos e Automação
                </label>
              </div>
            </div>
          </div>

          {showRedefinirSenha ? (
            <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
              <h4 className="font-semibold">Redefinir Senha do Administrador</h4>
              <div className="space-y-2">
                <Label htmlFor="nova-senha">Nova Senha *</Label>
                <Input
                  id="nova-senha"
                  type="text"
                  placeholder="Digite a nova senha (mín. 6 caracteres)"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  minLength={6}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowRedefinirSenha(false);
                    setNovaSenha("");
                  }}
                >
                  Cancelar
                </Button>
                <Button type="button" onClick={handleRedefinirSenha} disabled={loading}>
                  {loading ? "Redefinindo..." : "Confirmar Nova Senha"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                ✉️ A nova senha será enviada automaticamente por email e WhatsApp
              </p>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowRedefinirSenha(true)}
              className="w-full"
            >
              🔐 Redefinir Senha do Administrador
            </Button>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
