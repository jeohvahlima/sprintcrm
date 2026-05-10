import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Rocket, Save } from "lucide-react";
import { useBusinessContext, useSaveBusinessContext, BUSINESS_PHASES, BusinessPhase } from "@/hooks/useEstruturacao";
import { toast } from "sonner";

export function BusinessPhaseCard() {
  const { data: saved } = useBusinessContext();
  const save = useSaveBusinessContext();
  const [fase, setFase] = useState<BusinessPhase | undefined>();

  useEffect(() => { if (saved?.fase) setFase(saved.fase); }, [saved]);

  const onSave = async () => {
    if (!fase) return toast.error("Selecione a fase");
    try { await save.mutateAsync({ fase }); toast.success("Fase do negócio salva"); }
    catch (e: any) { toast.error(e?.message || "Erro"); }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-500/10">
            <Rocket className="h-5 w-5 text-amber-500" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-base">Fase do Negócio</CardTitle>
            <CardDescription>Onde sua operação está hoje? Isso ajusta as recomendações da IA.</CardDescription>
          </div>
          {fase && (
            <Badge className={`bg-gradient-to-r ${BUSINESS_PHASES.find((p) => p.key === fase)?.color} text-white border-0`}>
              {BUSINESS_PHASES.find((p) => p.key === fase)?.emoji} {BUSINESS_PHASES.find((p) => p.key === fase)?.label}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid md:grid-cols-3 gap-3">
          {BUSINESS_PHASES.map((p) => (
            <button
              key={p.key}
              onClick={() => setFase(p.key)}
              className={`text-left rounded-lg border-2 p-4 transition ${fase === p.key ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">{p.emoji}</span>
                <span className="font-semibold">{p.label}</span>
              </div>
              <p className="text-xs text-muted-foreground">{p.desc}</p>
            </button>
          ))}
        </div>
        <Button onClick={onSave} disabled={save.isPending || !fase} className="w-full">
          <Save className="h-4 w-4 mr-2" /> Salvar fase
        </Button>
      </CardContent>
    </Card>
  );
}
