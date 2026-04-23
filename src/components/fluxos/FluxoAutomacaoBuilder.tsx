import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VisualFlowBuilder } from "./VisualFlowBuilder";
import { 
  Plus, 
  MessageSquare, 
  ArrowRight,
  Trash2,
  Play,
  Edit,
  Zap
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface Fluxo {
  id: string;
  name: string;
  active: boolean;
  nodes: any[];
  edges: any[];
  created_at: string;
  updated_at: string;
}

export function FluxoAutomacaoBuilder() {
  const [selectedFluxoId, setSelectedFluxoId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const queryClient = useQueryClient();

  const { data: fluxos = [], isLoading } = useQuery({
    queryKey: ['automation_flows'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!userRoles?.company_id) return [];

      const { data, error } = await supabase
        .from('automation_flows')
        .select('*')
        .eq('company_id', userRoles.company_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as Fluxo[];
    },
  });

  const toggleFluxo = async (fluxoId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('automation_flows')
        .update({ active: !currentStatus })
        .eq('id', fluxoId);

      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ['automation_flows'] });
      toast.success(currentStatus ? "Fluxo desativado" : "Fluxo ativado");
    } catch (error) {
      toast.error("Erro ao atualizar fluxo");
    }
  };

  const criarNovoFluxo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!userRoles?.company_id) throw new Error('Empresa não encontrada');

      const newFlowId = crypto.randomUUID();

      const { error } = await supabase
        .from('automation_flows')
        .insert({
          id: newFlowId,
          name: 'Novo Fluxo',
          active: false,
          nodes: [],
          edges: [],
          company_id: userRoles.company_id,
          owner_id: user.id,
        });

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['automation_flows'] });
      setSelectedFluxoId(newFlowId);
      setEditMode(true);
      toast.success("Novo fluxo criado");
    } catch (error: any) {
      toast.error(error?.message || "Erro ao criar fluxo");
    }
  };

  const criarTemplateURA = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!userRoles?.company_id) throw new Error('Empresa não encontrada');

      const newFlowId = crypto.randomUUID();
      const triggerId = crypto.randomUUID();
      const menuId = crypto.randomUUID();
      const routeVendasId = crypto.randomUUID();
      const routeSuporteId = crypto.randomUUID();
      const routeFinanceiroId = crypto.randomUUID();

      const nodes = [
        {
          id: triggerId, type: 'trigger', position: { x: 50, y: 200 },
          data: { label: 'Nova Mensagem', triggerType: 'nova_mensagem', description: 'Quando uma nova mensagem chegar' },
        },
        {
          id: menuId, type: 'interactive_menu', position: { x: 350, y: 150 },
          data: {
            label: 'Menu URA',
            welcomeMessage: 'Olá! 👋 Bem-vindo ao nosso atendimento.\n\nEscolha o setor desejado:',
            menuStyle: 'text',
            aiUnderstandsFreeText: true,
            buttons: [
              { id: crypto.randomUUID(), label: 'Vendas' },
              { id: crypto.randomUUID(), label: 'Suporte' },
              { id: crypto.randomUUID(), label: 'Financeiro' },
            ],
          },
        },
        {
          id: routeVendasId, type: 'route_department', position: { x: 700, y: 50 },
          data: { label: 'Vendas', department: 'Vendas', transferMessage: '✅ Transferindo para o setor de Vendas. Aguarde um momento...' },
        },
        {
          id: routeSuporteId, type: 'route_department', position: { x: 700, y: 200 },
          data: { label: 'Suporte', department: 'Suporte', transferMessage: '✅ Transferindo para o Suporte Técnico. Aguarde um momento...' },
        },
        {
          id: routeFinanceiroId, type: 'route_department', position: { x: 700, y: 350 },
          data: { label: 'Financeiro', department: 'Financeiro', transferMessage: '✅ Transferindo para o setor Financeiro. Aguarde um momento...' },
        },
      ];

      const edges = [
        { id: crypto.randomUUID(), source: triggerId, target: menuId, type: 'smoothstep', animated: true },
        { id: crypto.randomUUID(), source: menuId, sourceHandle: 'btn_0', target: routeVendasId, type: 'smoothstep', animated: true },
        { id: crypto.randomUUID(), source: menuId, sourceHandle: 'btn_1', target: routeSuporteId, type: 'smoothstep', animated: true },
        { id: crypto.randomUUID(), source: menuId, sourceHandle: 'btn_2', target: routeFinanceiroId, type: 'smoothstep', animated: true },
      ];

      const { error } = await supabase
        .from('automation_flows')
        .insert({
          id: newFlowId,
          name: 'URA de Atendimento',
          active: false,
          nodes: nodes as any,
          edges: edges as any,
          company_id: userRoles.company_id,
          owner_id: user.id,
        });

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['automation_flows'] });
      setSelectedFluxoId(newFlowId);
      setEditMode(true);
      toast.success("Template URA criado! Configure os responsáveis de cada departamento.");
    } catch (error: any) {
      toast.error(error?.message || "Erro ao criar template URA");
    }
  };

  const excluirFluxo = async (fluxoId: string) => {
    try {
      const { error } = await supabase
        .from('automation_flows')
        .delete()
        .eq('id', fluxoId);

      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ['automation_flows'] });
      toast.success("Fluxo excluído");
    } catch (error) {
      toast.error("Erro ao excluir fluxo");
    }
  };

  const handleBack = () => {
    setEditMode(false);
    setSelectedFluxoId(null);
    queryClient.invalidateQueries({ queryKey: ['automation_flows'] });
  };

  if (editMode && selectedFluxoId) {
    return (
      <VisualFlowBuilder 
        fluxoId={selectedFluxoId} 
        onSave={handleBack}
        onBack={handleBack}
      />
    );
  }

  const fluxosAtivos = fluxos.filter((f) => f.active).length;
  const fluxosSemTrigger = fluxos.filter((f) => {
    const triggers = (f.nodes || []).filter((n: any) => n.type === 'trigger');
    return triggers.length === 0 || !triggers.some((t: any) =>
      ['nova_mensagem', 'palavra_chave'].includes(t.data?.triggerType)
    );
  });

  return (
    <div className="space-y-6">
      {fluxos.length > 0 && fluxosAtivos === 0 && (
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 text-sm">
          <strong>⚠️ Nenhum fluxo está ativo.</strong> A URA não vai disparar para nenhum contato até você ativar um fluxo abaixo.
        </div>
      )}
      {fluxosSemTrigger.length > 0 && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm">
          <strong>🚫 {fluxosSemTrigger.length} fluxo(s) sem gatilho válido:</strong> {fluxosSemTrigger.map((f) => f.name).join(', ')}. Adicione um gatilho "Nova mensagem" ou "Palavra-chave" para que ele dispare.
        </div>
      )}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Fluxos de Automação</h2>
          <p className="text-muted-foreground">
            Crie fluxos visuais para automatizar atendimento e processos
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.location.href = '/automacoes/diagnostico'}>
            🔍 Diagnóstico URA
          </Button>
          <Button onClick={criarNovoFluxo}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Fluxo
          </Button>
          <Button variant="outline" onClick={criarTemplateURA}>
            <Zap className="h-4 w-4 mr-2" />
            Template URA
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2">
          {[1, 2].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-muted rounded w-1/2" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="h-12 bg-muted rounded" />
                  <div className="h-12 bg-muted rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : fluxos.length > 0 ? (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
          {fluxos.map((fluxo) => (
            <Card key={fluxo.id} className="border-0 shadow-card hover:shadow-lg transition-all">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Zap className={`h-5 w-5 ${fluxo.active ? 'text-emerald-500' : 'text-muted-foreground'}`} />
                    {fluxo.name}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant={fluxo.active ? "default" : "secondary"}>
                      {fluxo.active ? "Ativo" : "Inativo"}
                    </Badge>
                    <Button
                      size="sm"
                      variant={fluxo.active ? "outline" : "default"}
                      onClick={() => toggleFluxo(fluxo.id, fluxo.active)}
                    >
                      {fluxo.active ? "Desativar" : "Ativar"}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  {fluxo.nodes && fluxo.nodes.length > 0 ? (
                    fluxo.nodes.slice(0, 3).map((node: any, index: number) => (
                      <div key={node.id || index}>
                        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                          <div className={`p-2 rounded-lg ${
                            node.type === 'trigger' ? 'bg-emerald-500' :
                            node.type === 'action' ? 'bg-amber-500' :
                            node.type === 'condition' ? 'bg-violet-500' :
                            node.type === 'ia' ? 'bg-blue-500' : 'bg-slate-500'
                          }`}>
                            <MessageSquare className="h-4 w-4 text-white" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium">{node.data?.label || 'Sem título'}</p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {node.type === 'trigger' ? 'Gatilho' : 
                               node.type === 'action' ? 'Ação' : 
                               node.type === 'condition' ? 'Condição' :
                               node.type === 'ia' ? 'IA' : node.type}
                            </p>
                          </div>
                        </div>
                        {index < Math.min(fluxo.nodes.length, 3) - 1 && (
                          <div className="flex justify-center py-1">
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4 text-sm text-muted-foreground">
                      Nenhum componente adicionado ainda
                    </div>
                  )}
                  {fluxo.nodes && fluxo.nodes.length > 3 && (
                    <p className="text-xs text-center text-muted-foreground">
                      +{fluxo.nodes.length - 3} componente(s)
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => {
                      setSelectedFluxoId(fluxo.id);
                      setEditMode(true);
                    }}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Editar
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1 text-destructive hover:text-destructive"
                    onClick={() => excluirFluxo(fluxo.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Play className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum fluxo criado</h3>
            <p className="text-muted-foreground text-center mb-4">
              Crie seu primeiro fluxo de automação para começar
            </p>
            <Button onClick={criarNovoFluxo}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Primeiro Fluxo
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
