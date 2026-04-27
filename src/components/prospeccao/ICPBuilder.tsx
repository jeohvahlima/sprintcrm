import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Plus, Trash2, Save, Target, Flame, Snowflake, Thermometer } from "lucide-react";
import { useICPProfiles, useSaveICPProfile, type ICPCriterion, type ICPProfile } from "@/hooks/useProspectingIntelligence";
import { toast } from "sonner";

const DEFAULT_CRITERIA: ICPCriterion[] = [
  { key: "segmento", label: "Segmento", weight: 25, options: [
    { value: "saude", label: "Saúde", score: 100 },
    { value: "saas", label: "SaaS B2B", score: 90 },
    { value: "servicos", label: "Serviços", score: 70 },
    { value: "outros", label: "Outros", score: 30 },
  ]},
  { key: "porte", label: "Porte (funcionários)", weight: 25, options: [
    { value: "1-10", label: "1-10", score: 30 },
    { value: "11-50", label: "11-50", score: 80 },
    { value: "51-200", label: "51-200", score: 100 },
    { value: "200+", label: "200+", score: 70 },
  ]},
  { key: "cargo", label: "Cargo do contato", weight: 25, options: [
    { value: "ceo", label: "CEO/Sócio", score: 100 },
    { value: "diretor", label: "Diretor", score: 90 },
    { value: "gerente", label: "Gerente", score: 60 },
    { value: "operacional", label: "Operacional", score: 20 },
  ]},
  { key: "urgencia", label: "Nível de dor", weight: 25, options: [
    { value: "alta", label: "Alta - busca solução agora", score: 100 },
    { value: "media", label: "Média - avaliando", score: 60 },
    { value: "baixa", label: "Baixa - apenas curioso", score: 20 },
  ]},
];

export function ICPBuilder() {
  const { data: profiles, isLoading } = useICPProfiles();
  const save = useSaveICPProfile();
  const [editing, setEditing] = useState<Partial<ICPProfile> | null>(null);

  useEffect(() => {
    if (!editing && !isLoading && profiles) {
      const first = profiles[0];
      if (first) setEditing(first);
      else setEditing({
        name: "ICP Principal",
        is_default: true,
        criteria: DEFAULT_CRITERIA,
        hot_threshold: 75,
        warm_threshold: 50,
      });
    }
  }, [profiles, isLoading]);

  if (!editing) return null;

  const totalWeight = (editing.criteria || []).reduce((s, c) => s + (c.weight || 0), 0);

  const updateCriterion = (idx: number, patch: Partial<ICPCriterion>) => {
    setEditing((p) => ({
      ...p!,
      criteria: (p!.criteria || []).map((c, i) => i === idx ? { ...c, ...patch } : c),
    }));
  };

  const removeCriterion = (idx: number) => {
    setEditing((p) => ({ ...p!, criteria: (p!.criteria || []).filter((_, i) => i !== idx) }));
  };

  const addCriterion = () => {
    setEditing((p) => ({
      ...p!,
      criteria: [...(p!.criteria || []), { key: `criterio_${Date.now()}`, label: "Novo critério", weight: 10, options: [] }],
    }));
  };

  const handleSave = async () => {
    if (totalWeight !== 100) {
      toast.error(`Pesos devem somar 100% (atual: ${totalWeight}%)`);
      return;
    }
    try {
      await save.mutateAsync(editing as any);
      toast.success("ICP salvo");
    } catch (e: any) {
      toast.error("Erro ao salvar", { description: e.message });
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="h-5 w-5 text-primary" /> Construtor de ICP (Perfil de Cliente Ideal)
              </CardTitle>
              <CardDescription>Defina critérios e pesos para classificar leads automaticamente.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {profiles && profiles.length > 0 && (
                <select
                  className="text-xs border rounded px-2 py-1.5 bg-background"
                  value={editing.id || ""}
                  onChange={(e) => {
                    const p = profiles.find((x) => x.id === e.target.value);
                    if (p) setEditing(p);
                  }}
                >
                  {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              )}
              <Button size="sm" variant="outline" onClick={() => setEditing({
                name: "Novo ICP",
                is_default: false,
                criteria: DEFAULT_CRITERIA,
                hot_threshold: 75,
                warm_threshold: 50,
              })}>
                <Plus className="h-3 w-3 mr-1" /> Novo
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Nome do perfil</Label>
              <Input value={editing.name || ""} onChange={(e) => setEditing((p) => ({ ...p!, name: e.target.value }))} />
            </div>
            <div className="flex items-end gap-2">
              <Badge variant={totalWeight === 100 ? "default" : "destructive"} className="text-xs">
                Soma dos pesos: {totalWeight}%
              </Badge>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3 p-3 border rounded-lg bg-muted/30">
            <div>
              <Label className="text-xs flex items-center gap-1">
                <Flame className="h-3 w-3 text-rose-500" /> Lead Quente ≥ {editing.hot_threshold}
              </Label>
              <Slider min={50} max={100} step={5} value={[editing.hot_threshold || 75]}
                onValueChange={(v) => setEditing((p) => ({ ...p!, hot_threshold: v[0] }))} />
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1">
                <Thermometer className="h-3 w-3 text-amber-500" /> Lead Morno ≥ {editing.warm_threshold}
              </Label>
              <Slider min={20} max={75} step={5} value={[editing.warm_threshold || 50]}
                onValueChange={(v) => setEditing((p) => ({ ...p!, warm_threshold: v[0] }))} />
            </div>
            <p className="col-span-2 text-[11px] text-muted-foreground flex items-center gap-1">
              <Snowflake className="h-3 w-3 text-sky-500" /> Abaixo de {editing.warm_threshold} = lead frio
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Critérios e Pesos</p>
              <Button size="sm" variant="ghost" onClick={addCriterion}>
                <Plus className="h-3 w-3 mr-1" /> Critério
              </Button>
            </div>
            {(editing.criteria || []).map((c, idx) => (
              <Card key={idx} className="bg-background">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input value={c.label} onChange={(e) => updateCriterion(idx, { label: e.target.value })} className="flex-1 h-8 text-sm" />
                    <div className="flex items-center gap-1 w-40">
                      <span className="text-xs text-muted-foreground">Peso</span>
                      <Input type="number" min={0} max={100} value={c.weight}
                        onChange={(e) => updateCriterion(idx, { weight: Number(e.target.value) })}
                        className="h-8 text-sm" />
                      <span className="text-xs">%</span>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => removeCriterion(idx)} className="h-8 w-8">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
                    {c.options.map((o, oi) => (
                      <div key={oi} className="flex gap-1 items-center text-xs border rounded p-1.5">
                        <span className="flex-1 truncate">{o.label}</span>
                        <Input type="number" min={0} max={100} value={o.score}
                          onChange={(e) => updateCriterion(idx, {
                            options: c.options.map((x, i) => i === oi ? { ...x, score: Number(e.target.value) } : x)
                          })}
                          className="h-6 w-12 text-xs" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Button onClick={handleSave} disabled={save.isPending} className="w-full">
            <Save className="h-4 w-4 mr-2" /> Salvar ICP
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
