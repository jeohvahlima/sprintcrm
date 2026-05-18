import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ExternalLink, CheckCircle2, AlertCircle, Loader2, KeyRound } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const NVOIP_PANEL_URL = 'https://painel.nvoip.com.br/main';
const NVOIP_SIGNUP_URL = 'https://nvoip.com.br/';

export const NvoipAccountPanel: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [form, setForm] = useState({
    number_sip: '',
    user_token: '',
    napikey: '',
    login_email: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('nvoip-call', {
        body: { action: 'get-config' },
      });
      if (error) throw error;
      const cfg = data?.config;
      if (cfg) {
        setForm({
          number_sip: cfg.number_sip || '',
          user_token: cfg.has_token ? '••••••••' : '',
          napikey: cfg.napikey || '',
          login_email: cfg.login_email || '',
        });
        setHasToken(!!cfg.has_token);
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!form.number_sip.trim()) {
      toast.error('Informe o NumberSIP');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke('nvoip-call', {
        body: { action: 'save-config', ...form },
      });
      if (error) throw error;
      toast.success('Credenciais Nvoip salvas');
      await load();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('nvoip-call', {
        body: { action: 'test-connection' },
      });
      if (error) throw error;
      toast.success(`Conectado à Nvoip (SIP ${data?.numberSip})`);
    } catch (e: any) {
      toast.error(e.message || 'Falha na conexão');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Login / Painel Nvoip */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-primary" />
            Acessar painel Nvoip
          </CardTitle>
          <CardDescription>
            Faça login no painel oficial da Nvoip para gerenciar números, créditos e obter suas credenciais de API.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            className="w-full"
            size="lg"
            onClick={() => window.open(NVOIP_PANEL_URL, '_blank', 'noopener,noreferrer')}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Abrir painel Nvoip (login)
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => window.open(NVOIP_SIGNUP_URL, '_blank', 'noopener,noreferrer')}
          >
            Não tem conta? Cadastre-se na Nvoip
          </Button>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              No painel da Nvoip vá em <strong>Configurações → API</strong> para copiar seu <strong>NumberSIP</strong>,{' '}
              <strong>user_token</strong> e <strong>napikey</strong>.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Credenciais */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {hasToken ? (
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            ) : (
              <AlertCircle className="w-5 h-5 text-yellow-500" />
            )}
            Conectar conta da empresa
          </CardTitle>
          <CardDescription>
            {hasToken
              ? 'Conta Nvoip conectada. Você pode atualizar as credenciais abaixo.'
              : 'Cole abaixo as credenciais da sua conta Nvoip para habilitar ligações.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="login_email">Email de login Nvoip (opcional)</Label>
                <Input
                  id="login_email"
                  type="email"
                  placeholder="seuemail@empresa.com"
                  value={form.login_email}
                  onChange={(e) => setForm({ ...form, login_email: e.target.value })}
                />
              </div>
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
                  placeholder={hasToken ? 'Deixe em branco para manter o atual' : 'Cole o user_token da Nvoip'}
                  value={form.user_token}
                  onChange={(e) => setForm({ ...form, user_token: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="napikey">napikey (opcional)</Label>
                <Input
                  id="napikey"
                  placeholder="Chave API para iniciar chamadas"
                  value={form.napikey}
                  onChange={(e) => setForm({ ...form, napikey: e.target.value })}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button onClick={handleSave} disabled={saving} className="flex-1">
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Salvar credenciais
                </Button>
                <Button variant="outline" onClick={handleTest} disabled={testing || !hasToken}>
                  {testing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Testar conexão
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default NvoipAccountPanel;
