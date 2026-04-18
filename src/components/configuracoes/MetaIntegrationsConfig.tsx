import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  MessageSquare, 
  Instagram, 
  Facebook, 
  Megaphone,
  Check,
  X,
  ExternalLink,
  Copy,
  RefreshCw,
  Loader2,
  Settings2
} from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import PixelSetupCard from "@/components/integrations/PixelSetupCard";

interface MetaIntegrationsConfigProps {
  companyId: string;
}

interface TenantIntegration {
  id: string;
  company_id: string;
  meta_access_token: string | null;
  meta_refresh_token: string | null;
  meta_token_expires_at: string | null;
  waba_id: string | null;
  whatsapp_phone_number_id: string | null;
  whatsapp_phone_number: string | null;
  whatsapp_status: string;
  instagram_ig_id: string | null;
  instagram_username: string | null;
  instagram_status: string;
  messenger_page_id: string | null;
  messenger_page_name: string | null;
  messenger_page_access_token: string | null;
  messenger_status: string;
  ad_account_id: string | null;
  lead_form_ids: string[] | null;
  marketing_status: string;
  granted_permissions: string[] | null;
  provider_priority: string;
}

const META_APP_ID = import.meta.env.VITE_META_APP_ID || '1574136874002258';
// App separado do Instagram (Login do Instagram com API Business)
const INSTAGRAM_APP_ID = import.meta.env.VITE_INSTAGRAM_APP_ID || '1353481286527361';
// Redireciona direto para a Edge Function (URL validada no Meta App).
// A função troca o code pelo token e redireciona o usuário de volta para /configuracoes.
const META_REDIRECT_URI = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID || 'dteppsfseusqixuppglh'}.supabase.co/functions/v1/meta-oauth-callback`;
const INSTAGRAM_REDIRECT_URI = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID || 'dteppsfseusqixuppglh'}.supabase.co/functions/v1/instagram-oauth-redirect`;

const getInstagramOAuthUrl = (companyId: string) => {
  const returnUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/configuracoes`
    : 'https://app.wazecrm.online/configuracoes';

  const state = btoa(JSON.stringify({ companyId, returnUrl }));

  return `https://www.instagram.com/oauth/authorize?force_reauth=true&client_id=${INSTAGRAM_APP_ID}&redirect_uri=${encodeURIComponent(INSTAGRAM_REDIRECT_URI)}&response_type=code&state=${encodeURIComponent(state)}&scope=instagram_business_basic%2Cinstagram_business_manage_messages%2Cinstagram_business_manage_comments%2Cinstagram_business_content_publish%2Cinstagram_business_manage_insights`;
};

// Token de verificação MASTER GLOBAL para multi-tenant SaaS
// IMPORTANTE: Este é o ÚNICO token usado para TODAS as subcontas
// Configure este mesmo token no painel Meta Developers
const MASTER_VERIFY_TOKEN = 'wazecrm_master_2024';

export function MetaIntegrationsConfig({ companyId }: MetaIntegrationsConfigProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [integration, setIntegration] = useState<TenantIntegration | null>(null);
  
  // Form states for manual configuration
  const [instagramToken, setInstagramToken] = useState('');
  const [instagramIgId, setInstagramIgId] = useState('');
  const [messengerPageId, setMessengerPageId] = useState('');
  const [messengerPageToken, setMessengerPageToken] = useState('');
  const [adAccountId, setAdAccountId] = useState('');
  const [marketingToken, setMarketingToken] = useState('');
  const [providerPriority, setProviderPriority] = useState<string>('both');

  useEffect(() => {
    loadIntegration();
  }, [companyId]);

  const loadIntegration = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('tenant_integrations')
        .select('*')
        .eq('company_id', companyId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setIntegration(data);
        setProviderPriority(data.provider_priority || 'both');
        setInstagramIgId(data.instagram_ig_id || '');
        setMessengerPageId(data.messenger_page_id || '');
        setAdAccountId(data.ad_account_id || '');
      }
    } catch (error: any) {
      console.error('Error loading integration:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar integrações',
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = (scope: string) => {
    if (scope === 'instagram') {
      window.open(getInstagramOAuthUrl(companyId), '_blank', 'width=700,height=800');
      return;
    }
    
    if (!META_APP_ID) {
      toast({
        variant: 'destructive',
        title: 'App ID não configurado',
        description: 'Configure VITE_META_APP_ID nas variáveis de ambiente'
      });
      return;
    }

    const state = btoa(JSON.stringify({ companyId, scope }));
    const permissions = getPermissionsForScope(scope);
    
    const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?` +
      `client_id=${META_APP_ID}` +
      `&redirect_uri=${encodeURIComponent(META_REDIRECT_URI)}` +
      `&scope=${encodeURIComponent(permissions.join(','))}` +
      `&state=${state}` +
      `&response_type=code`;

    window.open(authUrl, '_blank', 'width=600,height=700');
  };

  const getPermissionsForScope = (scope: string): string[] => {
    const basePermissions = ['public_profile'];
    
    switch (scope) {
      case 'whatsapp':
        return [...basePermissions, 'whatsapp_business_messaging', 'whatsapp_business_management'];
      case 'instagram':
        return [...basePermissions, 'instagram_basic', 'instagram_manage_messages', 'pages_manage_metadata', 'pages_read_engagement', 'pages_messaging'];
      case 'messenger':
        return [...basePermissions, 'pages_messaging', 'pages_manage_metadata', 'pages_read_engagement'];
      case 'marketing':
        return [...basePermissions, 'leads_retrieval', 'ads_read', 'business_management'];
      case 'all':
        return [...basePermissions, 
          'whatsapp_business_messaging', 'whatsapp_business_management',
          'instagram_basic', 'instagram_manage_messages',
          'pages_messaging', 'pages_manage_metadata', 'pages_read_engagement',
          'leads_retrieval', 'ads_read', 'business_management'
        ];
      default:
        return basePermissions;
    }
  };

  const saveInstagramConfig = async () => {
    try {
      setSaving(true);
      
      const updateData = {
        instagram_ig_id: instagramIgId || null,
        instagram_status: instagramIgId ? 'connected' : 'disconnected',
        meta_access_token: instagramToken || integration?.meta_access_token || null,
        updated_at: new Date().toISOString()
      };

      if (integration) {
        const { error } = await supabase
          .from('tenant_integrations')
          .update(updateData)
          .eq('id', integration.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('tenant_integrations')
          .insert({ company_id: companyId, ...updateData });
        if (error) throw error;
      }
      
      // Save instagram_account_id to whatsapp_connections (sem token de verificação por subconta)
      const { data: existingConn } = await supabase
        .from('whatsapp_connections')
        .select('id')
        .eq('company_id', companyId)
        .maybeSingle();
      
      const connectionData = {
        instagram_account_id: instagramIgId || null,
        instagram_access_token: instagramToken || null,
      };
      
      if (existingConn) {
        await supabase
          .from('whatsapp_connections')
          .update(connectionData)
          .eq('id', existingConn.id);
      } else {
        await supabase
          .from('whatsapp_connections')
          .insert({ 
            company_id: companyId, 
            instance_name: `META_${companyId.slice(0, 8).toUpperCase()}`,
            api_provider: 'meta',
            status: 'disconnected',
            ...connectionData
          });
      }

      toast({ title: 'Instagram configurado com sucesso!' });
      await loadIntegration();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } finally {
      setSaving(false);
    }
  };

  const saveMessengerConfig = async () => {
    try {
      setSaving(true);
      
      const updateData = {
        messenger_page_id: messengerPageId || null,
        messenger_page_access_token: messengerPageToken || null,
        messenger_status: messengerPageId ? 'connected' : 'disconnected',
        updated_at: new Date().toISOString()
      };

      if (integration) {
        const { error } = await supabase
          .from('tenant_integrations')
          .update(updateData)
          .eq('id', integration.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('tenant_integrations')
          .insert({ company_id: companyId, ...updateData });
        if (error) throw error;
      }

      toast({ title: 'Messenger configurado com sucesso!' });
      await loadIntegration();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } finally {
      setSaving(false);
    }
  };

  const saveMarketingConfig = async () => {
    try {
      setSaving(true);
      
      // Validar que o token foi informado
      if (!marketingToken && !integration?.meta_access_token) {
        toast({ 
          variant: 'destructive', 
          title: 'Token obrigatório', 
          description: 'Informe o Marketing Access Token para conectar' 
        });
        setSaving(false);
        return;
      }
      
      const updateData = {
        ad_account_id: adAccountId || null,
        meta_access_token: marketingToken || integration?.meta_access_token || null,
        marketing_status: adAccountId ? 'connected' : 'disconnected',
        updated_at: new Date().toISOString()
      };

      console.log('[Marketing] Saving config:', { 
        ad_account_id: updateData.ad_account_id, 
        has_token: !!updateData.meta_access_token,
        token_length: updateData.meta_access_token?.length 
      });

      if (integration) {
        const { error } = await supabase
          .from('tenant_integrations')
          .update(updateData)
          .eq('id', integration.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('tenant_integrations')
          .insert({ company_id: companyId, ...updateData });
        if (error) throw error;
      }

      toast({ title: 'Marketing API configurada com sucesso!' });
      setMarketingToken(''); // Limpar campo após salvar
      await loadIntegration();
    } catch (error: any) {
      console.error('[Marketing] Error saving:', error);
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } finally {
      setSaving(false);
    }
  };

  const saveProviderPriority = async () => {
    try {
      setSaving(true);
      
      if (integration) {
        const { error } = await supabase
          .from('tenant_integrations')
          .update({ 
            provider_priority: providerPriority,
            updated_at: new Date().toISOString()
          })
          .eq('id', integration.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('tenant_integrations')
          .insert({ 
            company_id: companyId, 
            provider_priority: providerPriority 
          });
        if (error) throw error;
      }

      toast({ title: 'Prioridade de provedor atualizada!' });
      await loadIntegration();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === 'connected') {
      return <Badge className="bg-green-500"><Check className="h-3 w-3 mr-1" /> Conectado</Badge>;
    }
    return <Badge variant="secondary"><X className="h-3 w-3 mr-1" /> Desconectado</Badge>;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copiado!' });
  };

  const webhookBaseUrl = `https://dteppsfseusqixuppglh.supabase.co/functions/v1`;

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Carregando integrações...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Facebook className="h-5 w-5 text-blue-600" />
              Integrações Meta (Facebook/Instagram)
            </CardTitle>
            <CardDescription>
              Configure WhatsApp oficial, Instagram, Messenger e Marketing API
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadIntegration}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="instagram" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="instagram" className="flex items-center gap-2">
              <Instagram className="h-4 w-4" />
              Instagram
            </TabsTrigger>
            <TabsTrigger value="messenger" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Messenger
            </TabsTrigger>
            <TabsTrigger value="marketing" className="flex items-center gap-2">
              <Megaphone className="h-4 w-4" />
              Marketing
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              Configurações
            </TabsTrigger>
          </TabsList>

          {/* Instagram Tab */}
          <TabsContent value="instagram" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Instagram className="h-5 w-5 text-pink-500" />
                Instagram Messaging API
              </h3>
              {getStatusBadge(integration?.instagram_status || 'disconnected')}
            </div>
            
            <Alert>
              <AlertDescription>
                Receba e responda mensagens do Instagram Direct pelo CRM. Requer conta comercial vinculada a uma página do Facebook.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <Button 
                onClick={() => handleOAuthLogin('instagram')}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              >
                <Instagram className="h-4 w-4 mr-2" />
                {integration?.instagram_status === 'connected' ? 'Reconectar Instagram' : 'Conectar com Facebook/Instagram'}
              </Button>

              {integration?.instagram_status === 'connected' && (
                <Button 
                  variant="destructive"
                  onClick={async () => {
                    if (!confirm('Tem certeza que deseja desconectar o Instagram?')) return;
                    try {
                      await supabase
                        .from('tenant_integrations')
                        .update({
                          instagram_status: 'disconnected',
                          instagram_ig_id: null,
                          instagram_username: null,
                          updated_at: new Date().toISOString()
                        })
                        .eq('company_id', companyId);
                      
                      // Also clear from whatsapp_connections
                      await supabase
                        .from('whatsapp_connections')
                        .update({
                          instagram_account_id: null,
                          instagram_access_token: null,
                        })
                        .eq('company_id', companyId);
                      
                      toast({ title: 'Instagram desconectado com sucesso' });
                      loadIntegration();
                    } catch (err: any) {
                      toast({ title: 'Erro ao desconectar', description: err.message, variant: 'destructive' });
                    }
                  }}
                  className="w-full"
                >
                  <X className="h-4 w-4 mr-2" />
                  Desconectar Instagram {integration?.instagram_username ? `(@${integration.instagram_username})` : ''}
                </Button>
              )}

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">ou configure manualmente</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Instagram Business Account ID</Label>
                  <Input 
                    placeholder="ID da conta comercial do Instagram"
                    value={instagramIgId}
                    onChange={(e) => setInstagramIgId(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Access Token</Label>
                  <Input 
                    type="password"
                    placeholder="Token de acesso do Graph API"
                    value={instagramToken}
                    onChange={(e) => setInstagramToken(e.target.value)}
                  />
                </div>
                <Button onClick={saveInstagramConfig} disabled={saving} className="w-full">
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Salvar Configuração
                </Button>
              </div>

              {integration?.instagram_username && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm">
                    <strong>Conta conectada:</strong> @{integration.instagram_username}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Webhook URL (configure no Facebook App)</Label>
                <div className="flex gap-2">
                  <Input 
                    readOnly 
                    value={`${webhookBaseUrl}/webhook-meta?channel=instagram`} 
                    className="font-mono text-xs"
                  />
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => copyToClipboard(`${webhookBaseUrl}/webhook-meta?channel=instagram`)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Token de Verificação Master (ÚNICO para todas subcontas)</Label>
                <div className="flex gap-2">
                  <Input 
                    readOnly 
                    value={MASTER_VERIFY_TOKEN} 
                    className="font-mono text-xs bg-green-50 border-green-300 dark:bg-green-950 dark:border-green-700"
                  />
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => copyToClipboard(MASTER_VERIFY_TOKEN)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  ⚠️ <strong>IMPORTANTE:</strong> Use este ÚNICO token no Meta Developers para TODAS as subcontas. 
                  Configure uma vez e todos os números/contas usarão o mesmo webhook.
                </p>
              </div>
            </div>
          </TabsContent>

          {/* Messenger Tab */}
          <TabsContent value="messenger" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-blue-500" />
                Facebook Messenger API
              </h3>
              {getStatusBadge(integration?.messenger_status || 'disconnected')}
            </div>
            
            <Alert>
              <AlertDescription>
                Receba e responda mensagens do Messenger da sua página do Facebook diretamente pelo CRM.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <Button 
                onClick={() => handleOAuthLogin('messenger')}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                <Facebook className="h-4 w-4 mr-2" />
                Conectar Página do Facebook
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">ou configure manualmente</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Page ID</Label>
                  <Input 
                    placeholder="ID da página do Facebook"
                    value={messengerPageId}
                    onChange={(e) => setMessengerPageId(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Page Access Token</Label>
                  <Input 
                    type="password"
                    placeholder="Token de acesso da página"
                    value={messengerPageToken}
                    onChange={(e) => setMessengerPageToken(e.target.value)}
                  />
                </div>
                <Button onClick={saveMessengerConfig} disabled={saving} className="w-full">
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Salvar Configuração
                </Button>
              </div>

              {integration?.messenger_page_name && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm">
                    <strong>Página conectada:</strong> {integration.messenger_page_name}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Webhook URL (configure no Facebook App)</Label>
                <div className="flex gap-2">
                  <Input 
                    readOnly 
                    value={`${webhookBaseUrl}/webhook-meta?channel=messenger`} 
                    className="font-mono text-xs"
                  />
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => copyToClipboard(`${webhookBaseUrl}/webhook-meta?channel=messenger`)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Marketing Tab */}
          <TabsContent value="marketing" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-orange-500" />
                Meta Marketing API
              </h3>
              {getStatusBadge(integration?.marketing_status || 'disconnected')}
            </div>
            
            <Alert>
              <AlertDescription>
                Sincronize leads de formulários do Facebook/Instagram, rastreie métricas de campanhas e atribua conversões automaticamente.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <Button 
                onClick={() => handleOAuthLogin('marketing')}
                className="w-full bg-orange-600 hover:bg-orange-700"
              >
                <Megaphone className="h-4 w-4 mr-2" />
                Conectar Conta de Anúncios
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">ou configure manualmente</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Ad Account ID</Label>
                  <Input 
                    placeholder="act_XXXXXXXX"
                    value={adAccountId}
                    onChange={(e) => setAdAccountId(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Marketing Access Token</Label>
                  <Input 
                    type="password"
                    placeholder="Token com permissões de ads"
                    value={marketingToken}
                    onChange={(e) => setMarketingToken(e.target.value)}
                  />
                </div>
                <Button onClick={saveMarketingConfig} disabled={saving} className="w-full">
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Salvar Configuração
                </Button>
              </div>

              {integration?.ad_account_id && (
                <div className="p-3 bg-muted rounded-lg space-y-2">
                  <p className="text-sm">
                    <strong>Conta de anúncios:</strong> {integration.ad_account_id}
                  </p>
                  {integration.lead_form_ids && integration.lead_form_ids.length > 0 && (
                    <p className="text-sm">
                      <strong>Formulários sincronizados:</strong> {integration.lead_form_ids.length}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Webhook URL para Lead Ads</Label>
                <div className="flex gap-2">
                  <Input 
                    readOnly 
                    value={`${webhookBaseUrl}/webhook-meta?channel=leads`} 
                    className="font-mono text-xs"
                  />
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => copyToClipboard(`${webhookBaseUrl}/webhook-meta?channel=leads`)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Pixel & Conversions API */}
              <div className="pt-4 border-t">
                <PixelSetupCard companyId={companyId} />
              </div>
            </div>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Configurações de Fallback
            </h3>
            
            <Alert>
              <AlertDescription>
                Configure qual API deve ser usada prioritariamente para envio de mensagens WhatsApp. 
                Evolution API permanece disponível como fallback automático.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Prioridade de Provedor WhatsApp</Label>
                <Select value={providerPriority} onValueChange={setProviderPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="meta">
                      Meta (WhatsApp Cloud API) - Usar apenas API oficial
                    </SelectItem>
                    <SelectItem value="evolution">
                      Evolution API - Usar apenas Evolution
                    </SelectItem>
                    <SelectItem value="both">
                      Ambos - Meta com fallback para Evolution
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Recomendado: "Ambos" para máxima estabilidade
                </p>
              </div>

              <Button onClick={saveProviderPriority} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Salvar Preferência
              </Button>
            </div>

            {integration?.granted_permissions && integration.granted_permissions.length > 0 && (
              <div className="space-y-2 pt-4 border-t">
                <Label>Permissões Concedidas</Label>
                <div className="flex flex-wrap gap-1">
                  {integration.granted_permissions.map((perm, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {perm}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-4 border-t">
              <h4 className="font-medium mb-3">Documentação</h4>
              <div className="grid gap-2">
                <a 
                  href="https://developers.facebook.com/docs/messenger-platform" 
                  target="_blank"
                  className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                >
                  <ExternalLink className="h-4 w-4" />
                  Messenger Platform Docs
                </a>
                <a 
                  href="https://developers.facebook.com/docs/instagram-api" 
                  target="_blank"
                  className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                >
                  <ExternalLink className="h-4 w-4" />
                  Instagram API Docs
                </a>
                <a 
                  href="https://developers.facebook.com/docs/marketing-apis" 
                  target="_blank"
                  className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                >
                  <ExternalLink className="h-4 w-4" />
                  Marketing API Docs
                </a>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
