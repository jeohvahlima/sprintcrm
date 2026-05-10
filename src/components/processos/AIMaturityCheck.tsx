import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bot, Save } from "lucide-react";
import { useAIMaturity, useSaveAIMaturity, AI_AGENTES, AINivel } from "@/hooks/useEstruturacao";
import { toast } from "sonner";

const NIVEIS: { key: AINivel; label: string; color: string }[] = [
  { key: "desligado", label: "Desligado", color: "bg-muted text-muted-foreground" },
  { key: "sugestivo", label: "Sugestivo", color: "bg-amber-500/20 text-amber-600 border-amber-500/40" },
  { key: "automatico", label: "Automático", color: "bg-emerald-500/20 text-emerald-600 border-emerald-500/40" },
];

export function AIMaturityCheck() {
  const { data: saved } = useAIMaturity();
  const save = useSaveAIMaturity();
  const [agentes, setAgentes] = useState<Record<string, AINivel>>({});

  useEffect(() => {
    if (saved?.agentes) setAgentes(saved.agentes);
  }, [saved]);

  const onSave = async () => {
    try {
      await save.mutateAsync(agentes);
      toast.success("Maturidade da IA salva");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar");
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-500/10">
            <Bot className="h-5 w-5 text-amber-500" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-base">Maturidade da IA Comercial</CardTitle>
            <CardDescription>Defina o nível de automação por agente de IA.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {AI_AGENTES.map((a) => {
          const current = agentes[a.key] || "desligado";
          return (
            <div key={a.key} className="border rounded-lg p-3">
              <div className="text-sm font-medium mb-2">{a.label}</div>
              <div className="flex gap-2">
                {NIVEIS.map((n) => (
                  <Button
                    key={n.key}
                    type="button"
                    size="sm"
                    variant={current === n.key ? "default" : "outline"}
                    onClick={() => setAgentes((p) => ({ ...p, [a.key]: n.key }))}
                    className="flex-1"
                  >
                    {n.label}
                  </Button>
                ))}
              </div>
            </div>
          );
        })}
        <Button className="w-full" onClick={onSave} disabled={save.isPending}>
          <Save className="h-4 w-4 mr-2" /> {save.isPending ? "Salvando..." : "Salvar"}
        </Button>
      </CardContent>
    </Card>
  );
}
