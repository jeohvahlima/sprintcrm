import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Database, Save, CheckCircle2 } from "lucide-react";
import { useCRMMaturity, useSaveCRMMaturity, CRM_CRITERIOS } from "@/hooks/useEstruturacao";
import { toast } from "sonner";

export function CRMMaturityCheck() {
  const { data: saved } = useCRMMaturity();
  const save = useSaveCRMMaturity();
  const [criterios, setCriterios] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (saved?.criterios) setCriterios(saved.criterios);
  }, [saved]);

  const total = CRM_CRITERIOS.length;
  const ativos = Object.values(criterios).filter(Boolean).length;
  const pct = Math.round((ativos / total) * 100);

  const onSave = async () => {
    try {
      await save.mutateAsync(criterios);
      toast.success(`Maturidade do CRM: ${pct}/100`);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar");
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500/20 to-emerald-500/10">
            <Database className="h-5 w-5 text-emerald-500" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-base">Maturidade do CRM</CardTitle>
            <CardDescription>Auto-avaliação dos pilares operacionais do CRM.</CardDescription>
          </div>
          <Badge variant="outline" className="font-mono">{ativos}/{total}</Badge>
        </div>
        <Progress value={pct} className="mt-3 h-2" />
      </CardHeader>
      <CardContent className="space-y-2">
        {CRM_CRITERIOS.map((c) => (
          <label key={c.key} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer">
            <Checkbox checked={!!criterios[c.key]} onCheckedChange={(v) => setCriterios((p) => ({ ...p, [c.key]: !!v }))} />
            <span className="text-sm flex-1">{c.label}</span>
            {criterios[c.key] && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
          </label>
        ))}
        <Button className="w-full mt-3" onClick={onSave} disabled={save.isPending}>
          <Save className="h-4 w-4 mr-2" /> {save.isPending ? "Salvando..." : "Salvar avaliação"}
        </Button>
      </CardContent>
    </Card>
  );
}
