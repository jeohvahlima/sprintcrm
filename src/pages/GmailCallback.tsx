import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle, Mail } from "lucide-react";

export default function GmailCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processando autorização...');
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const processCallback = async () => {
      try {
        const code = searchParams.get('code');
        const stateParam = searchParams.get('state');
        const error = searchParams.get('error');

        if (error) {
          setStatus('error');
          setMessage(`Autorização negada: ${error}`);
          return;
        }

        if (!code) {
          setStatus('error');
          setMessage('Código de autorização não encontrado');
          return;
        }

        // Extrair company_id do state
        let companyId: string | null = null;
        if (stateParam) {
          try {
            const decodedState = decodeURIComponent(stateParam);
            const state = JSON.parse(decodedState.startsWith('{') ? decodedState : atob(decodedState));
            companyId = state.company_id;
          } catch (e) {
            console.error('Erro ao parsear state:', e);
          }
        }

        // Se não tiver company_id no state, buscar do user_roles
        if (!companyId) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: userRole } = await supabase
              .from('user_roles')
              .select('company_id')
              .eq('user_id', user.id)
              .limit(1)
              .single();
            companyId = userRole?.company_id ?? null;
          }
        }

        if (!companyId) {
          setStatus('error');
          setMessage('Empresa não identificada');
          return;
        }

        // Chamar edge function para processar tokens
        const { data, error: fnError } = await supabase.functions.invoke('gmail-oauth-callback', {
          body: {
            code,
            company_id: companyId,
            redirect_uri: `${window.location.origin}/oauth/gmail/callback`,
            state: stateParam,
          },
        });

        if (fnError) {
          throw fnError;
        }

        if (data?.error) {
          throw new Error(data.error);
        }

        setStatus('success');
        setMessage('Gmail conectado com sucesso!');
        setEmail(data?.email);

        toast({
          title: "Gmail Conectado!",
          description: `Conta ${data?.email} vinculada com sucesso.`,
        });

        // Redirecionar após 2 segundos
        setTimeout(() => {
          navigate('/configuracoes');
        }, 2000);

      } catch (error: any) {
        console.error('Erro no callback Gmail:', error);
        setStatus('error');
        setMessage(error.message || 'Erro ao processar autorização');
      }
    };

    processCallback();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            {status === 'loading' && (
              <div className="p-3 bg-blue-100 rounded-full inline-block">
                <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
              </div>
            )}
            {status === 'success' && (
              <div className="p-3 bg-green-100 rounded-full inline-block">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            )}
            {status === 'error' && (
              <div className="p-3 bg-red-100 rounded-full inline-block">
                <XCircle className="h-8 w-8 text-red-600" />
              </div>
            )}
          </div>
          <CardTitle className="flex items-center justify-center gap-2">
            <Mail className="h-5 w-5" />
            {status === 'loading' && 'Conectando Gmail...'}
            {status === 'success' && 'Gmail Conectado!'}
            {status === 'error' && 'Erro na Conexão'}
          </CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        
        <CardContent className="text-center space-y-4">
          {status === 'success' && email && (
            <p className="text-sm bg-muted p-3 rounded-lg">
              <strong>Email:</strong> {email}
            </p>
          )}
          
          {status === 'success' && (
            <p className="text-xs text-muted-foreground">
              Redirecionando para configurações...
            </p>
          )}
          
          {status === 'error' && (
            <Button onClick={() => navigate('/configuracoes')}>
              Voltar para Configurações
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
