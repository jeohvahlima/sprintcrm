import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Building2, Plus, Pencil, Trash2, Users, RefreshCw, CheckCircle2, AlertCircle, UsersRound, Bot, MessageSquare, Video, Phone, Target, Workflow, KeyRound, Megaphone } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { NovaSubcontaDialog } from "./NovaSubcontaDialog";
import { EditarSubcontaDialog } from "./EditarSubcontaDialog";
import { UsuariosSubcontaDialog } from "./UsuariosSubcontaDialog";
import { CredenciaisSubcontaDialog } from "./CredenciaisSubcontaDialog";
import { SystemUpdatesManager } from "./SystemUpdatesManager";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Subconta {
  id: string;
  name: string;
  cnpj: string | null;
  plan: string;
  status: string;
  max_users: number;
  max_leads: number;
  created_at: string;
  settings: any;
  allow_group_messages: boolean;
  allow_ai_features: boolean;
  // Módulos Premium
  allow_chat_equipe: boolean;
  allow_reunioes: boolean;
  allow_discador: boolean;
  allow_processos_comerciais: boolean;
  allow_automacao: boolean;
}

export function SubcontasManager() {
  const { toast } = useToast();
  const [subcontas, setSubcontas] = useState<Subconta[]>([]);
  const [loading, setLoading] = useState(true);
  const [novaSubcontaOpen, setNovaSubcontaOpen] = useState(false);
  const [editarSubcontaOpen, setEditarSubcontaOpen] = useState(false);
  const [usuariosDialogOpen, setUsuariosDialogOpen] = useState(false);
  const [credenciaisDialogOpen, setCredenciaisDialogOpen] = useState(false);
  const [subcontaSelecionada, setSubcontaSelecionada] = useState<Subconta | null>(null);
  const [atualizando, setAtualizando] = useState(false);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [updateProgress, setUpdateProgress] = useState<{
    total: number;
    updated: number;
    skipped?: number;
    errors: string[];
    details: Array<{ 
      companyId: string; 
      companyName: string; 
      status: string; 
      message?: string;
      updatesApplied?: string[];
    }>;
  } | null>(null);
  const [parentCompanyId, setParentCompanyId] = useState<string | null>(null);

  useEffect(() => {
    carregarSubcontas();
    carregarParentCompanyId();
  }, []);

  const carregarParentCompanyId = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userRole, error } = await supabase.rpc('get_my_user_role');
      
      if (error) {
        console.error('Erro ao buscar role:', error);
        return;
      }

      // get_my_user_role retorna um array
      const role = Array.isArray(userRole) ? userRole[0] : userRole;

      if (role?.company_id) {
        setParentCompanyId(role.company_id);
      }
    } catch (error) {
      console.error('Erro ao carregar parent company ID:', error);
    }
  };

  const carregarSubcontas = async () => {
    try {
      setLoading(true);
      
      // Buscar company_id do usuário logado usando RPC
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userRole, error: roleError } = await supabase.rpc('get_my_user_role');
      
      if (roleError) {
        console.error('Erro ao buscar role:', roleError);
        throw roleError;
      }

      // get_my_user_role retorna um array
      const role = Array.isArray(userRole) ? userRole[0] : userRole;

      if (!role?.company_id) {
        console.warn('Usuário sem company_id');
        return;
      }

      // Buscar subcontas onde parent_company_id é a empresa do usuário
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('parent_company_id', role.company_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      console.log('✅ Subcontas carregadas:', data?.length || 0);
      setSubcontas(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar subcontas:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar subcontas',
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const abrirEditarSubconta = (subconta: Subconta) => {
    setSubcontaSelecionada(subconta);
    setEditarSubcontaOpen(true);
  };

  const abrirGerenciarUsuarios = (subconta: Subconta) => {
    setSubcontaSelecionada(subconta);
    setUsuariosDialogOpen(true);
  };

  const abrirCredenciais = (subconta: Subconta) => {
    setSubcontaSelecionada(subconta);
    setCredenciaisDialogOpen(true);
  };

  const deletarSubconta = async (id: string, nome: string) => {
    try {
      // Verificar dados associados
      const [leadsCount, tasksCount, conversasCount] = await Promise.all([
        supabase.from('leads').select('id', { count: 'exact', head: true }).eq('company_id', id),
        supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('company_id', id),
        supabase.from('conversas').select('id', { count: 'exact', head: true }).eq('company_id', id),
      ]);

      const totalRecords = (leadsCount.count || 0) + (tasksCount.count || 0) + (conversasCount.count || 0);

      // Mensagem de confirmação detalhada
      const confirmMessage = totalRecords > 0
        ? `A subconta "${nome}" possui ${totalRecords} registro(s) associado(s):\n` +
          `- ${leadsCount.count || 0} lead(s)\n` +
          `- ${tasksCount.count || 0} tarefa(s)\n` +
          `- ${conversasCount.count || 0} conversa(s)\n\n` +
          `TODOS estes dados serão PERMANENTEMENTE deletados junto com a subconta.\n\n` +
          `Esta ação NÃO PODE ser desfeita. Deseja continuar?`
        : `Tem certeza que deseja deletar a subconta "${nome}"? Esta ação não pode ser desfeita.`;

      if (!confirm(confirmMessage)) {
        return;
      }

      // Mostrar loading
      toast({
        title: 'Deletando subconta...',
        description: 'Por favor, aguarde. Isso pode levar alguns segundos.',
      });

      // Chamar edge function para deletar com service role
      const { data, error } = await supabase.functions.invoke('deletar-subconta', {
        body: { subcontaId: id }
      });

      if (error) throw error;

      toast({
        title: 'Subconta deletada com sucesso',
        description: data.deletedRecords > 0 
          ? `Subconta "${data.subcontaName}" e ${data.deletedRecords} registro(s) foram removidos.`
          : `Subconta "${data.subcontaName}" foi removida com sucesso.`,
      });

      await carregarSubcontas();
    } catch (error: any) {
      console.error('Erro ao deletar subconta:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao deletar subconta',
        description: error.message || 'Não foi possível deletar a subconta.',
      });
    }
  };

  const aplicarAtualizacoes = async () => {
    if (!parentCompanyId) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível identificar a conta matriz.',
      });
      return;
    }

    setAtualizando(true);
    setUpdateProgress(null);

    try {
      console.log('🔄 [SubcontasManager] Aplicando atualizações...');

      const { data, error } = await supabase.functions.invoke('aplicar-atualizacoes-subcontas', {
        body: {
          parentCompanyId: parentCompanyId,
          forceUpdate: true // Força reaplicação das melhorias
        }
      });

      if (error) throw error;

      console.log('✅ [SubcontasManager] Atualizações aplicadas:', data);

      setUpdateProgress({
        total: data.total || 0,
        updated: data.updated || 0,
        errors: data.errors || [],
        details: data.details || []
      });

      toast({
        title: 'Atualizações aplicadas!',
        description: `${data.updated} de ${data.total} subcontas foram atualizadas com sucesso.`,
      });

      // Recarregar subcontas para refletir mudanças
      await carregarSubcontas();

    } catch (error: any) {
      console.error('❌ [SubcontasManager] Erro ao aplicar atualizações:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao aplicar atualizações',
        description: error.message || 'Não foi possível aplicar as atualizações.',
      });
    } finally {
      setAtualizando(false);
    }
  };

  const toggleGroupMessages = async (subcontaId: string, currentValue: boolean) => {
    try {
      const newValue = !currentValue;
      
      const { error } = await supabase
        .from('companies')
        .update({ allow_group_messages: newValue })
        .eq('id', subcontaId);

      if (error) throw error;

      // Atualizar estado local
      setSubcontas(prev => prev.map(s => 
        s.id === subcontaId ? { ...s, allow_group_messages: newValue } : s
      ));

      toast({
        title: newValue ? 'Grupos ativados' : 'Grupos desativados',
        description: newValue 
          ? 'Esta subconta agora pode receber mensagens de grupos do WhatsApp.'
          : 'Esta subconta não receberá mais mensagens de grupos do WhatsApp.',
      });
    } catch (error: any) {
      console.error('Erro ao alterar configuração de grupos:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao alterar configuração',
        description: error.message,
      });
    }
  };

  const toggleAIFeatures = async (subcontaId: string, currentValue: boolean) => {
    try {
      const newValue = !currentValue;
      
      const { error } = await supabase
        .from('companies')
        .update({ allow_ai_features: newValue })
        .eq('id', subcontaId);

      if (error) throw error;

      // Atualizar estado local
      setSubcontas(prev => prev.map(s => 
        s.id === subcontaId ? { ...s, allow_ai_features: newValue } : s
      ));

      toast({
        title: newValue ? 'IA Ativada' : 'IA Desativada',
        description: newValue 
          ? 'Esta subconta agora pode utilizar os agentes de IA.'
          : 'Esta subconta não poderá mais utilizar os agentes de IA.',
      });
    } catch (error: any) {
      console.error('Erro ao alterar configuração de IA:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao alterar configuração',
        description: error.message,
      });
    }
  };

  // Toggle genérico para módulos premium
  const toggleModuloPremium = async (
    subcontaId: string, 
    campo: 'allow_chat_equipe' | 'allow_reunioes' | 'allow_discador' | 'allow_processos_comerciais' | 'allow_automacao',
    currentValue: boolean,
    nomeModulo: string
  ) => {
    try {
      const newValue = !currentValue;
      
      const { error } = await supabase
        .from('companies')
        .update({ [campo]: newValue })
        .eq('id', subcontaId);

      if (error) throw error;

      // Atualizar estado local
      setSubcontas(prev => prev.map(s => 
        s.id === subcontaId ? { ...s, [campo]: newValue } : s
      ));

      toast({
        title: newValue ? `${nomeModulo} Ativado` : `${nomeModulo} Desativado`,
        description: newValue 
          ? `Esta subconta agora pode acessar o módulo ${nomeModulo}.`
          : `Esta subconta não terá mais acesso ao módulo ${nomeModulo}.`,
      });
    } catch (error: any) {
      console.error(`Erro ao alterar configuração de ${nomeModulo}:`, error);
      toast({
        variant: 'destructive',
        title: 'Erro ao alterar configuração',
        description: error.message,
      });
    }
  };

  const getPlanBadge = (plan: string) => {
    const variants: Record<string, any> = {
      free: 'secondary',
      basic: 'default',
      premium: 'default',
    };
    const labels: Record<string, string> = {
      free: 'Free',
      basic: 'Padrão',
      premium: 'Premium',
    };
    return (
      <Badge variant={variants[plan] || 'default'}>
        {labels[plan] || plan}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      active: 'default',
      inactive: 'secondary',
      suspended: 'destructive',
    };
    const labels: Record<string, string> = {
      active: 'Ativa',
      inactive: 'Inativa',
      suspended: 'Suspensa',
    };
    return (
      <Badge variant={variants[status] || 'default'}>
        {labels[status] || status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Gerenciar Subcontas</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Carregando subcontas...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sistema de Atualizações para Subcontas */}
      <SystemUpdatesManager />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Gerenciar Subcontas / Licenças SaaS</CardTitle>
              <CardDescription>
                Crie e gerencie licenças de CRM para seus clientes
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={() => setShowUpdateDialog(true)}
                variant="outline"
                disabled={atualizando || subcontas.length === 0}
                className="border-primary/50 hover:bg-primary/10"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${atualizando ? 'animate-spin' : ''}`} />
                Aplicar Atualizações
              </Button>
              <Button onClick={() => setNovaSubcontaOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Nova Subconta
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {subcontas.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
              <h3 className="mt-4 text-lg font-semibold">Nenhuma subconta criada</h3>
              <p className="text-muted-foreground mt-2">
                Comece criando sua primeira licença de CRM para um cliente
              </p>
              <Button onClick={() => setNovaSubcontaOpen(true)} className="mt-4">
                <Plus className="mr-2 h-4 w-4" />
                Criar Primeira Subconta
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {subcontas.map((subconta) => (
                <div
                  key={subconta.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                      <h4 className="font-semibold text-lg">{subconta.name}</h4>
                      {getPlanBadge(subconta.plan)}
                      {getStatusBadge(subconta.status)}
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm text-muted-foreground">
                      {subconta.cnpj && (
                        <span>
                          <strong>CNPJ:</strong> {subconta.cnpj}
                        </span>
                      )}
                      <span>
                        <strong>Usuários:</strong> {subconta.max_users}
                      </span>
                      <span>
                        <strong>Leads:</strong> {subconta.max_leads}
                      </span>
                    </div>
                    {subconta.settings?.email && (
                      <div className="text-sm text-muted-foreground mt-1">
                        <strong>Contato:</strong> {subconta.settings.responsavel} • {subconta.settings.email}
                      </div>
                    )}
                    {/* Toggles de Funcionalidades Básicas */}
                    <div className="flex flex-wrap items-center gap-4 mt-2 pt-2 border-t border-border/50">
                      {/* Toggle de Grupos */}
                      <div className="flex items-center gap-2">
                        <UsersRound className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Grupos:</span>
                        <Switch
                          checked={subconta.allow_group_messages || false}
                          onCheckedChange={() => toggleGroupMessages(subconta.id, subconta.allow_group_messages || false)}
                        />
                        <span className={`text-xs font-medium ${subconta.allow_group_messages ? 'text-green-600' : 'text-muted-foreground'}`}>
                          {subconta.allow_group_messages ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                      
                      {/* Toggle de IA */}
                      <div className="flex items-center gap-2">
                        <Bot className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Agentes IA:</span>
                        <Switch
                          checked={subconta.allow_ai_features || false}
                          onCheckedChange={() => toggleAIFeatures(subconta.id, subconta.allow_ai_features || false)}
                        />
                        <span className={`text-xs font-medium ${subconta.allow_ai_features ? 'text-green-600' : 'text-muted-foreground'}`}>
                          {subconta.allow_ai_features ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                    </div>

                    {/* Toggles de Módulos Premium */}
                    <div className="flex flex-wrap items-center gap-3 mt-2 pt-2 border-t border-border/50">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Módulos Premium:</span>
                      
                      {/* Chat Equipe */}
                      <div className="flex items-center gap-1.5 bg-secondary/50 rounded px-2 py-1">
                        <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Chat</span>
                        <Switch
                          className="scale-75"
                          checked={subconta.allow_chat_equipe || false}
                          onCheckedChange={() => toggleModuloPremium(subconta.id, 'allow_chat_equipe', subconta.allow_chat_equipe || false, 'Chat Equipe')}
                        />
                      </div>
                      
                      {/* Reuniões */}
                      <div className="flex items-center gap-1.5 bg-secondary/50 rounded px-2 py-1">
                        <Video className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Reuniões</span>
                        <Switch
                          className="scale-75"
                          checked={subconta.allow_reunioes || false}
                          onCheckedChange={() => toggleModuloPremium(subconta.id, 'allow_reunioes', subconta.allow_reunioes || false, 'Reuniões')}
                        />
                      </div>
                      
                      {/* Call Center */}
                      <div className="flex items-center gap-1.5 bg-secondary/50 rounded px-2 py-1">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Call Center</span>
                        <Switch
                          className="scale-75"
                          checked={subconta.allow_discador || false}
                          onCheckedChange={() => toggleModuloPremium(subconta.id, 'allow_discador', subconta.allow_discador || false, 'Call Center')}
                        />
                      </div>
                      
                      {/* BPO Comercial */}
                      <div className="flex items-center gap-1.5 bg-secondary/50 rounded px-2 py-1">
                        <Target className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Processos</span>
                        <Switch
                          className="scale-75"
                          checked={subconta.allow_processos_comerciais || false}
                          onCheckedChange={() => toggleModuloPremium(subconta.id, 'allow_processos_comerciais', subconta.allow_processos_comerciais || false, 'Gestão de Processos')}
                        />
                      </div>
                      
                      {/* Automação */}
                      <div className="flex items-center gap-1.5 bg-secondary/50 rounded px-2 py-1">
                        <Workflow className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Automação</span>
                        <Switch
                          className="scale-75"
                          checked={subconta.allow_automacao || false}
                          onCheckedChange={() => toggleModuloPremium(subconta.id, 'allow_automacao', subconta.allow_automacao || false, 'Automação')}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => abrirCredenciais(subconta)}
                      title="Ver credenciais"
                      className="text-primary hover:text-primary hover:bg-primary/10"
                    >
                      <KeyRound className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => abrirGerenciarUsuarios(subconta)}
                      title="Gerenciar usuários"
                    >
                      <Users className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => abrirEditarSubconta(subconta)}
                      title="Editar subconta"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => deletarSubconta(subconta.id, subconta.name)}
                      title="Deletar subconta"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Confirmação de Atualização */}
      <AlertDialog open={showUpdateDialog} onOpenChange={setShowUpdateDialog}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Aplicar Atualizações nas Subcontas
            </AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-3">
                <p>
                  Esta ação irá aplicar <strong>apenas melhorias pendentes</strong> nas subcontas ativas.
                  O sistema é <strong>100% seguro</strong> e <strong>nunca altera dados existentes</strong>.
                </p>
                <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded p-3">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                    🔒 Garantias de Segurança:
                  </p>
                  <ul className="list-disc list-inside text-xs text-blue-700 dark:text-blue-300 space-y-1">
                    <li>Apenas adiciona dados novos (nunca altera existentes)</li>
                    <li>Pula subcontas que já estão atualizadas</li>
                    <li>Rastreia versões aplicadas para evitar duplicações</li>
                    <li>Preserva todas as configurações existentes</li>
                  </ul>
                </div>
                <p className="mt-3 font-medium text-foreground">
                  Total de subcontas: <strong>{subcontas.length}</strong>
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          {updateProgress && (
            <div className="space-y-3 py-4">
              <div className="flex items-center justify-between text-sm">
                <span>Progresso:</span>
                <span className="font-medium">
                  {updateProgress.updated} de {updateProgress.total} atualizadas
                </span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${updateProgress.total > 0 ? (updateProgress.updated / updateProgress.total) * 100 : 0}%` }}
                />
              </div>

              {updateProgress.details.length > 0 && (
                <div className="max-h-60 overflow-y-auto space-y-2 mt-4">
                  {updateProgress.details.map((detail, index) => (
                    <div
                      key={index}
                      className={`flex items-center gap-2 p-2 rounded text-sm ${
                        detail.status === 'success'
                          ? 'bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800'
                          : detail.status === 'skipped'
                          ? 'bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800'
                          : 'bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800'
                      }`}
                    >
                      {detail.status === 'success' ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                      ) : detail.status === 'skipped' ? (
                        <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                      )}
                      <span className="flex-1 font-medium">{detail.companyName}</span>
                      <span className="text-xs text-muted-foreground">
                        {detail.status === 'success' 
                          ? `✅ ${detail.message || 'Atualizada'}` 
                          : detail.status === 'skipped'
                          ? '✅ Já atualizada'
                          : '❌ Erro'}
                      </span>
                      {detail.updatesApplied && detail.updatesApplied.length > 0 && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {detail.updatesApplied.length} atualização(ões)
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {updateProgress.errors.length > 0 && (
                <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded">
                  <p className="text-sm font-medium text-red-900 dark:text-red-100 mb-2">
                    Erros encontrados:
                  </p>
                  <ul className="text-xs text-red-700 dark:text-red-300 space-y-1">
                    {updateProgress.errors.map((error, index) => (
                      <li key={index}>• {error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={atualizando}>
              {updateProgress ? 'Fechar' : 'Cancelar'}
            </AlertDialogCancel>
            {!updateProgress && (
              <AlertDialogAction
                onClick={aplicarAtualizacoes}
                disabled={atualizando}
                className="bg-primary hover:bg-primary/90"
              >
                {atualizando ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Aplicando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Aplicar Atualizações
                  </>
                )}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <NovaSubcontaDialog
        open={novaSubcontaOpen}
        onOpenChange={setNovaSubcontaOpen}
        onSuccess={carregarSubcontas}
      />

      {subcontaSelecionada && (
        <>
          <EditarSubcontaDialog
            company={subcontaSelecionada}
            open={editarSubcontaOpen}
            onOpenChange={setEditarSubcontaOpen}
            onSuccess={carregarSubcontas}
          />
          <UsuariosSubcontaDialog
            open={usuariosDialogOpen}
            onOpenChange={setUsuariosDialogOpen}
            company={{
              id: subcontaSelecionada.id,
              name: subcontaSelecionada.name
            }}
          />
          <CredenciaisSubcontaDialog
            open={credenciaisDialogOpen}
            onOpenChange={setCredenciaisDialogOpen}
            company={{
              id: subcontaSelecionada.id,
              name: subcontaSelecionada.name
            }}
          />
        </>
      )}
    </div>
  );
}
