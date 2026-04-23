import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  useAutomationDiagnostics,
  resetConversationState,
  MOTIVO_LABEL,
} from '@/hooks/useAutomationDiagnostics';
import { ArrowLeft, RefreshCw, Trash2, UserX } from 'lucide-react';

export default function AutomacaoDiagnostico() {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const { skipLogs, flowStates, assignments, loading, refetch } =
    useAutomationDiagnostics(companyId, search);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('user_roles')
        .select('company_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data?.company_id) setCompanyId(data.company_id);
    })();
  }, []);

  const reset = async (
    telefone: string,
    actions: Array<'flow_state' | 'assignment' | 'attendance'>,
  ) => {
    if (!companyId) return;
    try {
      const r = await resetConversationState(telefone, companyId, actions);
      toast.success(`Reset OK: ${JSON.stringify(r)}`);
      refetch();
    } catch (e: any) {
      toast.error(e?.message || 'Erro');
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
          </Button>
          <h1 className="text-2xl font-bold mt-2">Diagnóstico da URA</h1>
          <p className="text-muted-foreground text-sm">
            Veja por que a URA não disparou para um contato e libere conversas travadas.
          </p>
        </div>
        <Button variant="outline" onClick={refetch} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      <div className="flex gap-2 max-w-md">
        <Input
          placeholder="Filtrar por número (ex: 558799...)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">URA aguardando resposta ({flowStates.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-80 overflow-auto">
            {flowStates.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma URA travada.</p>
            )}
            {flowStates.map((s) => (
              <div key={s.conversation_number} className="flex items-center justify-between gap-2 border rounded p-2">
                <div className="text-sm">
                  <div className="font-mono">{s.conversation_number}</div>
                  <div className="text-xs text-muted-foreground">
                    expira: {new Date(s.expires_at).toLocaleString('pt-BR')}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => reset(s.conversation_number, ['flow_state'])}>
                  <Trash2 className="h-3 w-3 mr-1" /> Resetar URA
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Em atendimento humano ({assignments.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-80 overflow-auto">
            {assignments.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma conversa atribuída.</p>
            )}
            {assignments.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-2 border rounded p-2">
                <div className="text-sm">
                  <div className="font-mono">{a.telefone_formatado}</div>
                  <div className="text-xs text-muted-foreground">
                    desde: {new Date(a.created_at).toLocaleString('pt-BR')}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => reset(a.telefone_formatado, ['assignment', 'attendance'])}>
                  <UserX className="h-3 w-3 mr-1" /> Liberar
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Eventos de bloqueio (últimos 100)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 max-h-[600px] overflow-auto">
          {skipLogs.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhum bloqueio registrado ainda. Eventos aparecem aqui assim que a URA decide não disparar.
            </p>
          )}
          {skipLogs.map((log) => {
            const meta = MOTIVO_LABEL[log.motivo] || { label: log.motivo, color: 'bg-zinc-500', tip: '' };
            return (
              <div key={log.id} className="border rounded p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={`${meta.color} text-white`}>{meta.label}</Badge>
                      <span className="font-mono text-xs">{log.telefone}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(log.created_at).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{meta.tip}</p>
                    {log.details && Object.keys(log.details).length > 0 && (
                      <pre className="text-[10px] bg-muted p-2 rounded mt-2 overflow-x-auto">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button size="sm" variant="ghost" onClick={() => reset(log.telefone, ['flow_state'])}>
                      Resetar URA
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => reset(log.telefone, ['assignment', 'attendance'])}>
                      Liberar humano
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
