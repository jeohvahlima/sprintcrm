import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Smartphone, Monitor, Apple, Download, CheckCircle2, Share2, Plus } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function InstallApp() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const installedHandler = () => setInstalled(true);

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installedHandler);

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 py-12 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-primary/10 mb-2">
            <Download className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight">Instalar o WAZE CRM</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Tenha o CRM como um aplicativo no seu celular ou computador. Acesso rápido,
            tela cheia e ícone próprio — sem precisar abrir o navegador.
          </p>
        </header>

        {installed ? (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="flex items-center gap-4 py-6">
              <CheckCircle2 className="w-10 h-10 text-primary flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-lg">App já instalado!</h3>
                <p className="text-muted-foreground text-sm">
                  Você já está usando o WAZE CRM como aplicativo. Pode fechar esta página.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : deferredPrompt ? (
          <Card className="border-primary/30">
            <CardContent className="flex flex-col sm:flex-row items-center gap-4 py-6">
              <Download className="w-10 h-10 text-primary flex-shrink-0" />
              <div className="flex-1 text-center sm:text-left">
                <h3 className="font-semibold text-lg">Instalação rápida disponível</h3>
                <p className="text-muted-foreground text-sm">
                  Seu navegador suporta instalação direta. Clique no botão para instalar agora.
                </p>
              </div>
              <Button size="lg" onClick={handleInstall}>
                <Download className="w-4 h-4 mr-2" /> Instalar agora
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
                <Smartphone className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>Android</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <ol className="space-y-2 list-decimal list-inside text-muted-foreground">
                <li>Abra esta página no <strong className="text-foreground">Chrome</strong></li>
                <li>Toque no menu <strong className="text-foreground">⋮</strong> (3 pontos)</li>
                <li>Selecione <strong className="text-foreground">"Instalar app"</strong> ou <strong className="text-foreground">"Adicionar à tela inicial"</strong></li>
                <li>Confirme em <strong className="text-foreground">"Instalar"</strong></li>
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
                <Apple className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>iPhone / iPad</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <ol className="space-y-2 list-decimal list-inside text-muted-foreground">
                <li>Abra esta página no <strong className="text-foreground">Safari</strong></li>
                <li>Toque no botão <Share2 className="w-4 h-4 inline" /> <strong className="text-foreground">Compartilhar</strong></li>
                <li>Role e selecione <Plus className="w-4 h-4 inline" /> <strong className="text-foreground">"Adicionar à Tela de Início"</strong></li>
                <li>Toque em <strong className="text-foreground">"Adicionar"</strong></li>
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
                <Monitor className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>Computador</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <ol className="space-y-2 list-decimal list-inside text-muted-foreground">
                <li>Abra no <strong className="text-foreground">Chrome</strong> ou <strong className="text-foreground">Edge</strong></li>
                <li>Procure o ícone <Download className="w-4 h-4 inline" /> de instalação na barra de endereço</li>
                <li>Ou vá em menu → <strong className="text-foreground">"Instalar WAZE CRM"</strong></li>
                <li>Confirme em <strong className="text-foreground">"Instalar"</strong></li>
              </ol>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-muted/40">
          <CardContent className="py-6 space-y-2 text-sm text-muted-foreground">
            <p>
              <strong className="text-foreground">Dica:</strong> a instalação só funciona no
              site publicado (não no editor). Compartilhe o link
              <strong className="text-foreground"> https://app.wazecrm.online/instalar</strong> com sua equipe.
            </p>
            <p>
              Após instalado, o app aparece com ícone próprio e abre em tela cheia, igual a um
              aplicativo nativo. Atualizações chegam automaticamente.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
