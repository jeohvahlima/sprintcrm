import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, Loader2, Megaphone, Users, Target } from "lucide-react";
import { TRILHAS_TEMPLATE, Trilha, TrilhaStatus, useFunnelProgress, useSaveFunnelStep } from "@/hooks/useEstrategiaComercial";
import { toast } from "sonner";

const TRILHA_META: Record<Trilha, { icon: any; color: string }> = {
  vsl: { icon: Target, color: "from-blue-500 to-cyan-400" },
  social_selling: { icon: Users, color: "from-pink-500 to-rose-400" },
  isca_paga: { icon: Megaphone, color: "from-amber-500 to-orange-400" },
};

const STATUS_CYCLE: TrilhaStatus[] = ["nao_iniciado", "em_construcao", "ativo"];
const STATUS_META: Record<TrilhaStatus, { label: string; icon: any; color: string }> = {
  nao_iniciado: { label: "Não iniciado", icon: Circle, color: "text-muted-foreground" },
  em_construcao: { label: "Em construção", icon: Loader2, color: "text-amber-500" },
  ativo: { label: "Ativo", icon: CheckCircle2, color: "text-emerald-500" },
};

export function MarketingFunnelTracks() {
  const { data: progress = [] } = useFunnelProgress();
  const save = useSaveFunnelStep();

  const getStatus = (trilha: Trilha, key: string): TrilhaStatus => {
    const found = progress.find((p) => p.trilha === trilha && p.etapa_key === key);
    return (found?.status as TrilhaStatus) || "nao_iniciado";
  };

  const cycleStatus = async (trilha: Trilha, key: string, label: string, ordem: number) => {
    const current = getStatus(trilha, key);
    const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(current) + 1) % STATUS_CYCLE.length];
    try {
      await save.mutateAsync({
        trilha,
        etapa_key: key,
        etapa_label: label,
        status: next,
        ordem,
      });
      toast.success(`${label}: ${STATUS_META[next].label}`);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar");
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            Trilhas de Funis de Marketing
          </CardTitle>
          <CardDescription>
            Construa as 3 trilhas de geração de demanda da metodologia GROW. Clique em cada etapa para alternar o status.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid lg:grid-cols-3 gap-4">
        {(Object.keys(TRILHAS_TEMPLATE) as Trilha[]).map((trilha) => {
          const tpl = TRILHAS_TEMPLATE[trilha];
          const meta = TRILHA_META[trilha];
          const Icon = meta.icon;
          const ativos = tpl.etapas.filter((e) => getStatus(trilha, e.key) === "ativo").length;
          const construcao = tpl.etapas.filter((e) => getStatus(trilha, e.key) === "em_construcao").length;
          const total = tpl.etapas.length;
          const pct = Math.round((ativos / total) * 100);

          return (
            <Card key={trilha} className="overflow-hidden">
              <div className={`h-1.5 bg-gradient-to-r ${meta.color}`} />
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg bg-gradient-to-br ${meta.color} text-white`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <CardTitle className="text-sm flex-1">{tpl.label}</CardTitle>
                  <Badge variant="secondary" className="font-mono text-xs">{ativos}/{total}</Badge>
                </div>
                <Progress value={pct} className="h-1.5 mt-2" />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>{construcao} em construção</span>
                  <span>{pct}% ativo</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {tpl.etapas.map((etapa, idx) => {
                  const status = getStatus(trilha, etapa.key);
                  const sm = STATUS_META[status];
                  const SIcon = sm.icon;
                  return (
                    <Button
                      key={etapa.key}
                      variant="outline"
                      className="w-full justify-start h-auto py-2 px-3 text-left"
                      onClick={() => cycleStatus(trilha, etapa.key, etapa.label, idx)}
                    >
                      <SIcon className={`h-4 w-4 ${sm.color} ${status === "em_construcao" ? "animate-spin" : ""} flex-shrink-0`} />
                      <span className="text-xs ml-2 flex-1">{etapa.label}</span>
                    </Button>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
