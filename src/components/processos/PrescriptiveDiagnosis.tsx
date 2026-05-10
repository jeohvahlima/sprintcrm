import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Stethoscope, Sparkles, ArrowRight, ListChecks } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { usePrescriptiveRules, useLogDiagnosis, useGenerateActionPlan } from "@/hooks/useEstruturacao";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const MODULO_ROUTE: Record<string, string> = {
  prospeccao: "/prospeccao",
  fluxos: "/fluxos",
  processos: "/processos",
  funil: "/kanban",
  analytics: "/analytics",
  rh: "/maturidade",
  ia: "/ia",
  leads: "/leads",
  discador: "/discador",
  integracao: "/configuracoes",
  site: "/site-publico",
};

export function PrescriptiveDiagnosis() {
  const navigate = useNavigate();
  const { data: rules = [], isLoading } = usePrescriptiveRules();
  const logDx = useLogDiagnosis();
  const generatePlan = useGenerateActionPlan();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showResult, setShowResult] = useState(false);

  const toggle = (k: string) => setSelected((p) => {
    const n = new Set(p);
    n.has(k) ? n.delete(k) : n.add(k);
    return n;
  });

  const matched = rules.filter((r) => selected.has(r.sintoma_key));

  const runDiagnosis = async () => {
    if (selected.size === 0) return toast.error("Selecione pelo menos um sintoma");
    setShowResult(true);
    try {
      await logDx.mutateAsync({
        sintomas: Array.from(selected),
        acoes: matched.map((r) => ({ sintoma: r.sintoma_key, acao: r.acao_prescrita, modulo: r.modulo_destino })),
      });
    } catch {/* silent log */}
  };

  const reset = () => {
    setSelected(new Set());
    setShowResult(false);
  };

  return (
    <div className="space-y-4">
      <Card className="border-2">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-rose-500/20 to-rose-500/10">
              <Stethoscope className="h-5 w-5 text-rose-500" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-base">Diagnóstico Prescritivo</CardTitle>
              <CardDescription>Marque os sintomas que sua operação está sentindo. A metodologia GROW devolve causas e ações prescritas.</CardDescription>
            </div>
            <Badge variant="outline">{selected.size} selecionados</Badge>
          </div>
        </CardHeader>
      </Card>

      {!showResult ? (
        <Card>
          <CardContent className="p-5 space-y-2 max-h-[500px] overflow-y-auto">
            {isLoading && <p className="text-sm text-muted-foreground">Carregando regras...</p>}
            {rules.map((r) => (
              <label key={r.sintoma_key} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer">
                <Checkbox checked={selected.has(r.sintoma_key)} onCheckedChange={() => toggle(r.sintoma_key)} />
                <span className="text-sm flex-1">{r.sintoma_label}</span>
              </label>
            ))}
          </CardContent>
          <div className="p-4 border-t flex justify-between items-center">
            <Button variant="outline" onClick={reset}>Limpar</Button>
            <Button onClick={runDiagnosis} disabled={selected.size === 0}>
              <Sparkles className="h-4 w-4 mr-2" /> Rodar diagnóstico
            </Button>
          </div>
        </Card>
      ) : (
        <>
          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> {matched.length} ação{matched.length !== 1 ? "ões" : ""} prescrita{matched.length !== 1 ? "s" : ""}
              </CardTitle>
              <CardDescription>Priorize de cima para baixo (peso da metodologia GROW).</CardDescription>
            </CardHeader>
            {matched.length > 0 && (
              <CardContent className="pt-0">
                <Button
                  className="w-full"
                  disabled={generatePlan.isPending}
                  onClick={async () => {
                    try {
                      const n = await generatePlan.mutateAsync(
                        matched.map((r) => ({
                          sintoma_label: r.sintoma_label,
                          causa_provavel: r.causa_provavel,
                          acao_prescrita: r.acao_prescrita,
                          modulo_destino: r.modulo_destino,
                          prioridade: r.prioridade,
                        }))
                      );
                      toast.success(`${n} tarefa(s) criada(s) no módulo Tarefas`, {
                        action: { label: "Ver", onClick: () => navigate("/tarefas") },
                      });
                    } catch (e: any) {
                      toast.error(e?.message || "Erro ao gerar plano");
                    }
                  }}
                >
                  <ListChecks className="h-4 w-4 mr-2" />
                  {generatePlan.isPending ? "Gerando plano..." : "Gerar plano de ação no módulo Tarefas"}
                </Button>
              </CardContent>
            )}
          </Card>
          <div className="space-y-3">
            {matched
              .sort((a, b) => b.prioridade - a.prioridade)
              .map((r) => {
                const route = r.modulo_destino ? MODULO_ROUTE[r.modulo_destino] : null;
                return (
                  <Card key={r.id} className="border-l-4 border-l-primary">
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline">Prioridade {r.prioridade}</Badge>
                        {r.pilar && <Badge variant="secondary" className="text-xs">{r.pilar}</Badge>}
                      </div>
                      <div className="font-semibold">🔥 {r.sintoma_label}</div>
                      <div className="text-sm">
                        <span className="text-muted-foreground">Causa provável:</span> {r.causa_provavel}
                      </div>
                      <div className="text-sm bg-primary/5 rounded p-2 border border-primary/20">
                        <strong>Ação prescrita:</strong> {r.acao_prescrita}
                      </div>
                      {route && (
                        <Button variant="ghost" size="sm" onClick={() => navigate(route)} className="w-full justify-between">
                          Ir para o módulo {r.modulo_destino} <ArrowRight className="h-3 w-3" />
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
          </div>
          <Button variant="outline" onClick={reset} className="w-full">Novo diagnóstico</Button>
        </>
      )}
    </div>
  );
}
