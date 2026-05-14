import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Check, X, ExternalLink, RefreshCw, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface GmailConfigProps {
  companyId: string;
}

export function GmailConfig({ companyId }: GmailConfigProps) {
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [gmailEmail, setGmailEmail] = useState<string | null>(null);
  const [gmailStatus, setGmailStatus] = useState<string>('disconnected');

  useEffect(() => {
    loadGmailStatus();
  }, [companyId]);

  const loadGmailStatus = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('tenant_integrations')
        .select('gmail_email, gmail_status')
        .eq('company_id', companyId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Erro ao carregar status Gmail:', error);
      }

      if (data) {
        setGmailEmail(data.gmail_email);
        setGmailStatus(data.gmail_status || 'disconnected');
      }
    } catch (error) {
      console.error('Erro:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    const isEmbeddedPreview = (() => {
      try {
        return window.self !== window.top;
      } catch {
        return true;
      }
    })();
    const oauthWindow = isEmbeddedPreview ? window.open('', 'gmail_oauth') : null;

    try {
      setConnecting(true);
      const redirectUri = `${window.location.origin}/oauth/gmail/callback`;
      const { data, error } = await supabase.functions.invoke('gmail-oauth-start', {
        body: { company_id: companyId, redirect_uri: redirectUri },
      });

      if (error) throw error;
      if (!data?.auth_url) throw new Error('URL de autorização não gerada');

      if (oauthWindow && !oauthWindow.closed) {
        oauthWindow.location.href = data.auth_url;
        return;
      }

      window.location.assign(data.auth_url);
    } catch (error: any) {
      if (oauthWindow && !oauthWindow.closed) oauthWindow.close();
      toast({
        title: "Erro de Configuração",
        description: error?.message || "Não foi possível iniciar a conexão com o Gmail.",
        variant: "destructive",
      });
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setDisconnecting(true);

      const { error } = await supabase
        .from('tenant_integrations')
        .update({
          gmail_access_token: null,
          gmail_refresh_token: null,
          gmail_token_expires_at: null,
          gmail_email: null,
          gmail_status: 'disconnected',
          updated_at: new Date().toISOString(),
        })
        .eq('company_id', companyId);

      if (error) throw error;

      setGmailEmail(null);
      setGmailStatus('disconnected');

      toast({
        title: "Gmail Desconectado",
        description: "A integração com Gmail foi removida.",
      });
    } catch (error: any) {
      console.error('Erro ao desconectar:', error);
      toast({
        title: "Erro",
        description: "Não foi possível desconectar o Gmail.",
        variant: "destructive",
      });
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const isConnected = gmailStatus === 'connected' && gmailEmail;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <Mail className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <CardTitle className="text-lg">Gmail</CardTitle>
              <CardDescription>
                Envie e receba emails diretamente pelo CRM
              </CardDescription>
            </div>
          </div>
          <Badge variant={isConnected ? "default" : "secondary"}>
            {isConnected ? (
              <>
                <Check className="h-3 w-3 mr-1" />
                Conectado
              </>
            ) : (
              <>
                <X className="h-3 w-3 mr-1" />
                Desconectado
              </>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConnected ? (
          <>
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-1">Email conectado:</p>
              <p className="font-medium">{gmailEmail}</p>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadGmailStatus}
                disabled={loading}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar Status
              </Button>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={disconnecting}>
                    {disconnecting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <X className="h-4 w-4 mr-2" />
                    )}
                    Desconectar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Desconectar Gmail?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Isso removerá a integração com o Gmail. Você não poderá mais enviar ou receber emails pelo CRM até reconectar.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDisconnect}>
                      Desconectar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </>
        ) : (
          <>
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">
                Conecte sua conta Gmail para enviar e receber emails diretamente do CRM.
                Seus emails serão enviados do seu email pessoal, não de um endereço genérico.
              </p>
            </div>

            <Button onClick={handleConnect} disabled={connecting}>
              {connecting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4 mr-2" />
              )}
              Conectar Gmail
            </Button>

            <p className="text-xs text-muted-foreground">
              Ao conectar, você autoriza o CRM a enviar emails em seu nome.
              Nenhuma senha é armazenada.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
