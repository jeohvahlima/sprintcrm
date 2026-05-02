import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GoogleCalendarCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const ranRef = useRef(false);
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const code = params.get("code");
    const error = params.get("error");
    const state = params.get("state");

    if (error) {
      setStatus("error");
      setMessage(`Autorização cancelada: ${error}`);
      return;
    }
    if (!code) {
      setStatus("error");
      setMessage("Código de autorização ausente");
      return;
    }

    const redirect_uri = `${window.location.origin}/google-calendar-callback`;

    supabase.functions
      .invoke("google-calendar-oauth-callback", { body: { code, redirect_uri, state } })
      .then(({ data, error }) => {
        if (error) throw error;
        setStatus("success");
        setMessage(`Conectado: ${data?.email ?? ""}`);
        setTimeout(() => navigate("/configuracoes?tab=integracoes"), 1500);
      })
      .catch((e) => {
        setStatus("error");
        setMessage(e?.message || "Falha ao trocar código por tokens");
      });
  }, [params, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md w-full text-center space-y-4 p-8 rounded-lg border bg-card">
        {status === "loading" && (
          <>
            <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary" />
            <h1 className="text-xl font-bold">Conectando ao Google Calendar...</h1>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle2 className="h-12 w-12 mx-auto text-primary" />
            <h1 className="text-xl font-bold">Conectado!</h1>
            <p className="text-muted-foreground">{message}</p>
            <p className="text-xs text-muted-foreground">Redirecionando...</p>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="h-12 w-12 mx-auto text-destructive" />
            <h1 className="text-xl font-bold">Erro na conexão</h1>
            <p className="text-muted-foreground text-sm">{message}</p>
            <Button onClick={() => navigate("/configuracoes?tab=integracoes")}>Voltar</Button>
          </>
        )}
      </div>
    </div>
  );
}
