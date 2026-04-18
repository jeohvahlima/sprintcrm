import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processando autenticação...');

  useEffect(() => {
    const callbackKey = `${searchParams.get('code') || 'no-code'}:${window.location.origin}`;

    if (sessionStorage.getItem(`instagram_oauth_processed_${callbackKey}`)) {
      console.log('[OAuthCallback] Duplicate callback ignored');
      return;
    }

    sessionStorage.setItem(`instagram_oauth_processed_${callbackKey}`, 'true');

    const processOAuthCallback = async () => {
      const code = searchParams.get('code');
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      console.log('[OAuthCallback] Starting processing...');
      console.log('[OAuthCallback] Code present:', !!code);
      console.log('[OAuthCallback] Error:', error);

      if (error) {
        setStatus('error');
        setMessage(errorDescription || 'Autenticação cancelada pelo usuário');
        return;
      }

      if (!code) {
        setStatus('error');
        setMessage('Código de autorização não encontrado');
        return;
      }

      try {
        // === STEP 1: Get companyId ===
        // Try localStorage first (saved before redirect)
        let companyId = localStorage.getItem('instagram_oauth_company_id');
        console.log('[OAuthCallback] CompanyId from localStorage:', companyId);

        if (!companyId) {
          console.log('[OAuthCallback] No companyId in localStorage, trying auth...');
          
          // Try getting session (may take time to restore after redirect)
          let user = null;
          
          // Attempt 1: getSession
          const { data: { session } } = await supabase.auth.getSession();
          console.log('[OAuthCallback] Session found:', !!session);
          
          if (session?.user) {
            user = session.user;
          } else {
            // Attempt 2: wait and retry
            console.log('[OAuthCallback] Waiting 2s for session restore...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            const { data: { user: retryUser } } = await supabase.auth.getUser();
            console.log('[OAuthCallback] Retry user found:', !!retryUser);
            user = retryUser;
          }

          if (user) {
            const { data: userRole } = await supabase
              .from('user_roles')
              .select('company_id')
              .eq('user_id', user.id)
              .limit(1)
              .single();
            companyId = userRole?.company_id || null;
            console.log('[OAuthCallback] CompanyId from user_roles:', companyId);
          }
        }

        if (!companyId) {
          console.error('[OAuthCallback] No companyId found anywhere');
          setStatus('error');
          setMessage('Empresa não encontrada. Volte às configurações e tente conectar novamente.');
          return;
        }

        // Clean up
        localStorage.removeItem('instagram_oauth_company_id');

        // === STEP 2: Call edge function ===
        console.log('[OAuthCallback] Calling edge function with companyId:', companyId);
        setMessage('Trocando código por token...');

        const { data, error: fnError } = await supabase.functions.invoke('instagram-oauth-callback', {
          body: {
            code,
            companyId,
            redirectUri: window.location.origin + '/oauth/callback'
          }
        });

        console.log('[OAuthCallback] Edge function response:', data);
        console.log('[OAuthCallback] Edge function error:', fnError);

        if (fnError) {
          let errorMsg = 'Erro na função de autenticação';
          if (typeof fnError.message === 'string') {
            errorMsg = fnError.message;
          }
          try {
            const body = JSON.parse((fnError as any)?.context?.body || '{}');
            if (body.error) errorMsg = body.error;
          } catch {}
          throw new Error(errorMsg);
        }

        if (data?.success) {
          setStatus('success');
          setMessage(`Instagram conectado com sucesso! ${data.username ? '@' + data.username : ''}`);
          toast({
            title: 'Sucesso!',
            description: 'Instagram conectado ao CRM com sucesso.'
          });
          
          setTimeout(() => {
            navigate('/configuracoes', { replace: true });
          }, 2000);
        } else {
          throw new Error(data?.error || 'Erro ao processar autenticação');
        }
      } catch (err: any) {
        console.error('[OAuthCallback] Error:', err);
        setStatus('error');
        const errorMessage = err.message || 'Erro ao processar autenticação';
        if (errorMessage.includes('authorization code has been used')) {
          setMessage('Esse login já foi processado. Feche esta aba, volte em Configurações e conecte o Instagram novamente.');
          sessionStorage.removeItem(`instagram_oauth_processed_${callbackKey}`);
          return;
        }

        setMessage(errorMessage);
        sessionStorage.removeItem(`instagram_oauth_processed_${callbackKey}`);
      }
    };

    processOAuthCallback();
  }, [searchParams, navigate, toast]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md text-center space-y-6">
        {status === 'processing' && (
          <>
            <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto" />
            <h1 className="text-2xl font-bold">Conectando Instagram...</h1>
            <p className="text-muted-foreground">{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <h1 className="text-2xl font-bold text-green-600">Conectado!</h1>
            <p className="text-muted-foreground">{message}</p>
            <p className="text-sm text-muted-foreground">Redirecionando para configurações...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="h-16 w-16 text-destructive mx-auto" />
            <h1 className="text-2xl font-bold text-destructive">Erro na Conexão</h1>
            <p className="text-muted-foreground">{message}</p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => navigate('/configuracoes')}>
                Voltar às Configurações
              </Button>
              <Button onClick={() => window.location.reload()}>
                Tentar Novamente
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
