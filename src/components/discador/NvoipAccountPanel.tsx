import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Loader2, KeyRound, ShieldCheck, Wallet, Radio, RefreshCw, LogOut } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AccountInfo {
  numberSip: string;
  balance: any;
  balanceError: string | null;
  tokenIssuedAt: string;
}

export const NvoipAccountPanel: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [form, setForm] = useState({
    number_sip: '',
    user_token: '',
    napikey: '',
    login_email: '',
    caller_number: '',
  });

  const loadAccount = useCallback(async () => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('nvoip-call', {
        body: { action: 'account-info' },
      });
      if (error) throw error;
      if (data?.success === false) throw new Error('Não foi possível autenticar na Nvoip. Verifique o NumberSIP e o User Token.');
      setAccount(data);
      setConnectionError(null);
      return true;
    } catch (e: any) {
      console.error('Erro ao buscar dados da central:', e);
      const message = e.message || 'Não foi possível buscar dados da central';
      setAccount(null);
      setShowForm(true);
      setHasToken(false);
      setForm((f) => ({ ...f, user_token: '' }));
      setConnectionError(message);
      return false;
    } finally {
      setRefreshing(false);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('nvoip-call', {
        body: { action: 'get-config' },
      });
      if (error) throw error;
      const cfg = data?.config;
      if (cfg) {
        setForm((f) => ({
          ...f,
          number_sip: cfg.number_sip || '',
          user_token: cfg.has_token ? '••••••••' : '',
          napikey: cfg.napikey || '',
          login_email: cfg.login_email || '',
          caller_number: cfg.caller_number || '',
        }));
        setHasToken(!!cfg.has_token);
        if (cfg.has_token) {
          const ok = await loadAccount();
          if (!ok) setShowForm(true);
        } else {
          setShowForm(true);
        }
      } else {
        setShowForm(true);
      }
    } catch (e) {
      console.error(e);
      setShowForm(true);
    } finally {
      setLoading(false);
    }
  }, [loadAccount]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    const passwordToSave = form.user_token.trim();
    const shouldPreservePassword = hasToken && passwordToSave === '••••••••';

    if (!form.number_sip.trim() || (!shouldPreservePassword && !passwordToSave)) {
      toast.error('Preencha o NumberSIP e o User Token');
      return;
    }
    if (!shouldPreservePassword && passwordToSave.length <= 8) {
      const message = 'Esse valor parece ser um código temporário. Cole o User Token completo da Nvoip em Configurações → API.';
      setConnectionError(message);
      toast.error(message);
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('nvoip-call', {
        body: {
          action: 'save-config',
          number_sip: form.number_sip,
          user_token: passwordToSave || undefined,
          napikey: form.napikey,
          login_email: form.login_email,
          caller_number: form.caller_number,
        },
      });
      if (error) throw error;
      if (data?.success === false) throw new Error('Não foi possível autenticar na Nvoip. Verifique o NumberSIP e o User Token.');
      toast.success('Central conectada com sucesso');
      setConnectionError(null);
      setShowForm(false);
      await load();
    } catch (e: any) {
      const message = e.message || 'Erro ao salvar';
      setConnectionError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  // Extrai saldo de forma resiliente (a API pode retornar formatos variados)
  const renderBalance = () => {
    if (!account?.balance) return account?.balanceError ? 'Indisponível' : '—';
    const b = account.balance;
    const value = b.balance ?? b.saldo ?? b.value ?? b.amount;
    if (typeof value === 'number') {
      return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }
    if (typeof value === 'string') return value;
    return JSON.stringify(b);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {loading ? (
        <Card>
          <CardContent className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Painel pós-login (sessão ativa) */}
          {hasToken && account && (
            <Card className="border-green-500/40 bg-green-500/5">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                      Sessão ativa na Central Telefônica
                      <Badge variant="outline" className="border-green-500/50 text-green-600 dark:text-green-400">
                        <Radio className="w-3 h-3 mr-1 animate-pulse" />
                        Online
                      </Badge>
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Login autenticado com sucesso. Você já pode iniciar chamadas pelo CRM.
                    </CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" onClick={loadAccount} disabled={refreshing}>
                    <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border bg-background p-3">
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Wallet className="w-3.5 h-3.5" /> Saldo da conta
                    </div>
                    <div className="text-xl font-bold mt-1">{renderBalance()}</div>
                  </div>
                  <div className="rounded-lg border bg-background p-3">
                    <div className="text-xs text-muted-foreground">ID da Central</div>
                    <div className="text-xl font-bold font-mono mt-1">{account.numberSip}</div>
                  </div>
                  <div className="rounded-lg border bg-background p-3">
                    <div className="text-xs text-muted-foreground">Última autenticação</div>
                    <div className="text-sm font-medium mt-1">
                      {new Date(account.tokenIssuedAt).toLocaleTimeString('pt-BR')}
                    </div>
                  </div>
                </div>

                {account.balanceError && (
                  <Alert variant="destructive" className="py-2">
                    <AlertDescription className="text-xs">
                      Saldo indisponível: {account.balanceError}. O login está ativo, mas a operadora não respondeu ao endpoint de saldo.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" onClick={() => setShowForm((s) => !s)}>
                    <KeyRound className="w-4 h-4 mr-2" />
                    {showForm ? 'Ocultar credenciais' : 'Editar credenciais'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Formulário de credenciais */}
          {(!hasToken || showForm) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-primary" />
                  {hasToken ? 'Atualizar credenciais' : 'Acesso à Central Telefônica'}
                </CardTitle>
                <CardDescription>
                  {hasToken
                    ? 'Atualize os dados de acesso da sua central quando precisar.'
                    : 'Informe as credenciais da sua central telefônica para habilitar ligações dentro do CRM.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {connectionError && (
                  <Alert variant="destructive">
                    <AlertDescription>
                      {connectionError} O User Token fica no painel Nvoip em Configurações → API; não use senha, código SMS ou token de 6 dígitos.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="number_sip">NumberSIP *</Label>
                    <Input
                      id="number_sip"
                      placeholder="Ex: 137715001"
                      value={form.number_sip}
                      onChange={(e) => setForm({ ...form, number_sip: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="user_token">User Token *</Label>
                    <Input
                      id="user_token"
                      type="password"
                      placeholder={hasToken ? 'Mantenha em branco para preservar' : 'Cole o User Token'}
                      value={form.user_token}
                      onChange={(e) => setForm({ ...form, user_token: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Cole o User Token completo gerado em Configurações → API da Nvoip.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="napikey">Chave de API (Napikey)</Label>
                  <Input
                    id="napikey"
                    placeholder="Necessária para iniciar chamadas reais"
                    value={form.napikey}
                    onChange={(e) => setForm({ ...form, napikey: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="caller_number">Número do ramal/DID (originador) *</Label>
                  <Input
                    id="caller_number"
                    placeholder="Ex: 558132998470 (número que toca primeiro para conectar a ligação)"
                    value={form.caller_number}
                    onChange={(e) => setForm({ ...form, caller_number: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Esse é o número (chip/celular ou DID) cadastrado na Nvoip que vai tocar primeiro. Ao atender, a Nvoip disca para o cliente e conecta as duas pontas.
                  </p>
                </div>

                <Alert>
                  <ShieldCheck className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Suas credenciais são armazenadas de forma segura na nossa nuvem e usadas apenas para autenticar
                    ligações em nome da sua empresa. Nenhum dado é compartilhado com terceiros.
                  </AlertDescription>
                </Alert>

                <div className="flex gap-2 pt-2">
                  <Button onClick={handleSave} disabled={saving} className="flex-1">
                    {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {hasToken ? 'Atualizar conexão' : 'Conectar central'}
                  </Button>
                  {hasToken && (
                    <Button variant="outline" onClick={() => setShowForm(false)}>
                      Cancelar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default NvoipAccountPanel;
