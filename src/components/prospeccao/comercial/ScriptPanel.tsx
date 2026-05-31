import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export function ScriptPanel() {
  const [activeTab, setActiveTab] = useState<"abertura" | "objecoes" | "fechamento">("abertura");

  return (
    <Card className="rounded-xl">
      <CardHeader className="border-b">
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">📜 Script de Abertura — Cold Call</CardTitle>
          <div className="flex gap-2">
            {["abertura", "objecoes", "fechamento"].map((tab) => (
              <Button
                key={tab}
                size="sm"
                variant={activeTab === tab ? "default" : "outline"}
                onClick={() => setActiveTab(tab as any)}
                className="text-xs capitalize"
              >
                {tab === "abertura" ? "Abertura" : tab === "objecoes" ? "Objeções" : "Fechamento"}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {activeTab === "abertura" && (
          <div className="space-y-4">
            <div>
              <div className="text-xs font-bold uppercase text-muted-foreground mb-2">Abertura padrão</div>
              <p className="text-sm text-foreground leading-relaxed bg-slate-50 dark:bg-slate-900/30 p-4 rounded-lg border border-border">
                "Oi, aqui é o <span className="font-bold bg-blue-100 dark:bg-blue-900/30 px-1 rounded">[seu nome]</span> da GrowOS. Eu vi que a{" "}
                <span className="font-bold bg-blue-100 dark:bg-blue-900/30 px-1 rounded">[Empresa]</span> atua no segmento de{" "}
                <span className="font-bold bg-blue-100 dark:bg-blue-900/30 px-1 rounded">[segmento]</span> e empresas similares estão usando nossa
                plataforma para <span className="font-bold bg-blue-100 dark:bg-blue-900/30 px-1 rounded">aumentar a conversão de leads em 3x</span>.
                Você tem 2 minutos para eu te mostrar como?"
              </p>
            </div>
          </div>
        )}

        {activeTab === "objecoes" && (
          <div className="space-y-4">
            <div className="text-xs font-bold uppercase text-muted-foreground mb-4">Objeções comuns</div>
            {[
              { q: '😤 "Não tenho tempo agora"', a: '→ "Entendo! Que tal 10 min na sexta às 10h? Prometo ser objetivo."' },
              { q: '💰 "Está caro"', a: '→ "Faz sentido. Mas se te mostrar que o ROI é de 4x, mudaria de opinião?"' },
              { q: '🤔 "Já uso outra ferramenta"', a: '→ "Ótimo! Me conta como está funcionando? Clientes que vieram de lá economizaram 40%."' },
            ].map((item, idx) => (
              <div key={idx} className="flex gap-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition">
                <div className="font-semibold text-sm min-w-fit">{item.q}</div>
                <div className="text-sm text-muted-foreground flex-1">{item.a}</div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "fechamento" && (
          <div className="space-y-4">
            <div className="text-xs font-bold uppercase text-muted-foreground mb-4">Estratégia de fechamento</div>
            <p className="text-sm text-foreground leading-relaxed bg-slate-50 dark:bg-slate-900/30 p-4 rounded-lg border border-border">
              Após demonstração ou discussão de interesse:
            </p>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>1. <span className="font-semibold text-foreground">Resumir valores propostos</span> — Qual foi o maior problema identificado?</p>
              <p>2. <span className="font-semibold text-foreground">Confirmar fit</span> — Isso atende sua necessidade?</p>
              <p>3. <span className="font-semibold text-foreground">Fechar</span> — Que tal começarmos com um teste de 14 dias? Você topa?</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
