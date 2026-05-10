import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Target, ArrowLeft, ArrowRight, Save, Printer, Check } from "lucide-react";
import { useICPStructured, useSaveICP, ICPStructured } from "@/hooks/useEstrategiaComercial";
import { toast } from "sonner";

const STEPS = [
  { key: "quem_e", label: "Quem é", emoji: "👤", color: "from-blue-500 to-cyan-400" },
  { key: "dores", label: "Dores", emoji: "🔥", color: "from-rose-500 to-orange-400" },
  { key: "gatilhos", label: "Gatilhos de compra", emoji: "⚡", color: "from-amber-500 to-yellow-400" },
] as const;

export function ICPWizard() {
  const { data: saved } = useICPStructured();
  const save = useSaveICP();
  const [step, setStep] = useState(0);
  const [icp, setIcp] = useState<ICPStructured>({ quem_e: {}, dores: {}, gatilhos: {} });

  useEffect(() => {
    if (saved) setIcp(saved);
  }, [saved]);

  const update = (block: keyof ICPStructured, field: string, val: string) => {
    setIcp((prev) => ({ ...prev, [block]: { ...(prev[block] as any), [field]: val } }));
  };

  const onSave = async () => {
    try {
      await save.mutateAsync(icp);
      toast.success("ICP salvo com sucesso");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar");
    }
  };

  const isFilled = (block: "quem_e" | "dores" | "gatilhos") =>
    Object.values((icp[block] as any) || {}).some((v) => !!v);

  return (
    <div className="space-y-4">
      <Card className="border-2">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-base">ICP Estruturado — 3 etapas</CardTitle>
              <CardDescription>
                Defina seu cliente ideal de forma estruturada. Esta ficha alimenta automaticamente as IAs de prospecção.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Stepper */}
      <div className="flex items-center justify-between gap-2">
        {STEPS.map((s, i) => (
          <button
            key={s.key}
            onClick={() => setStep(i)}
            className={`flex-1 p-3 rounded-lg border-2 transition text-left ${
              step === i ? "border-primary bg-primary/5" : "border-border"
            }`}
          >
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded bg-gradient-to-br ${s.color} text-white text-sm w-7 h-7 flex items-center justify-center`}>
                {isFilled(s.key) ? <Check className="h-3.5 w-3.5" /> : s.emoji}
              </div>
              <div>
                <div className="text-[10px] uppercase text-muted-foreground">Passo {i + 1}</div>
                <div className="text-sm font-medium">{s.label}</div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Form per step */}
      <Card>
        <CardContent className="p-6 space-y-4">
          {step === 0 && (
            <>
              <h3 className="font-semibold text-lg flex items-center gap-2">👤 Quem é o seu cliente ideal</h3>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <Label>Segmento / Indústria</Label>
                  <Input value={icp.quem_e.segmento || ""} onChange={(e) => update("quem_e", "segmento", e.target.value)} placeholder="Ex: SaaS B2B, Saúde, Educação..." />
                </div>
                <div>
                  <Label>Porte / Tamanho</Label>
                  <Input value={icp.quem_e.porte || ""} onChange={(e) => update("quem_e", "porte", e.target.value)} placeholder="Ex: 10-50 funcionários" />
                </div>
                <div>
                  <Label>Cargo do decisor</Label>
                  <Input value={icp.quem_e.cargo_decisor || ""} onChange={(e) => update("quem_e", "cargo_decisor", e.target.value)} placeholder="Ex: CEO, Diretor Comercial" />
                </div>
                <div>
                  <Label>Faturamento típico</Label>
                  <Input value={icp.quem_e.faturamento || ""} onChange={(e) => update("quem_e", "faturamento", e.target.value)} placeholder="Ex: R$ 500k-2M/ano" />
                </div>
                <div className="md:col-span-2">
                  <Label>Geografia</Label>
                  <Input value={icp.quem_e.geografia || ""} onChange={(e) => update("quem_e", "geografia", e.target.value)} placeholder="Ex: Sul e Sudeste do Brasil" />
                </div>
              </div>
            </>
          )}
          {step === 1 && (
            <>
              <h3 className="font-semibold text-lg flex items-center gap-2">🔥 Dores que ele sente</h3>
              <div className="space-y-3">
                <div>
                  <Label>Dor principal (a que mais arde)</Label>
                  <Textarea rows={2} value={icp.dores.principal || ""} onChange={(e) => update("dores", "principal", e.target.value)} placeholder="O que tira o sono do seu cliente?" />
                </div>
                <div>
                  <Label>Dores secundárias</Label>
                  <Textarea rows={2} value={icp.dores.secundarias || ""} onChange={(e) => update("dores", "secundarias", e.target.value)} placeholder="Outros problemas relacionados" />
                </div>
                <div>
                  <Label>Consequência se não resolver</Label>
                  <Textarea rows={2} value={icp.dores.consequencia || ""} onChange={(e) => update("dores", "consequencia", e.target.value)} placeholder="O que acontece se ele continuar com o problema?" />
                </div>
                <div>
                  <Label>O que ele já tentou e não funcionou</Label>
                  <Textarea rows={2} value={icp.dores.tentativas_anteriores || ""} onChange={(e) => update("dores", "tentativas_anteriores", e.target.value)} placeholder="Soluções, ferramentas, métodos anteriores" />
                </div>
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <h3 className="font-semibold text-lg flex items-center gap-2">⚡ Gatilhos de compra</h3>
              <div className="space-y-3">
                <div>
                  <Label>Evento gatilho</Label>
                  <Textarea rows={2} value={icp.gatilhos.evento || ""} onChange={(e) => update("gatilhos", "evento", e.target.value)} placeholder="Ex: 'Acabou de receber investimento', 'Demitiu time de vendas'..." />
                </div>
                <div>
                  <Label>Fator de urgência</Label>
                  <Textarea rows={2} value={icp.gatilhos.urgencia || ""} onChange={(e) => update("gatilhos", "urgencia", e.target.value)} placeholder="Por que ele precisa resolver AGORA?" />
                </div>
                <div>
                  <Label>Principais objeções esperadas</Label>
                  <Textarea rows={2} value={icp.gatilhos.objecoes || ""} onChange={(e) => update("gatilhos", "objecoes", e.target.value)} placeholder="Ex: preço, timing, autoridade..." />
                </div>
                <div>
                  <Label>Canais preferidos</Label>
                  <Input value={icp.gatilhos.canais_preferidos || ""} onChange={(e) => update("gatilhos", "canais_preferidos", e.target.value)} placeholder="Ex: WhatsApp, LinkedIn, Email" />
                </div>
              </div>
            </>
          )}

          <div className="flex items-center justify-between pt-4 border-t">
            <Button variant="outline" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Anterior
            </Button>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={onSave} disabled={save.isPending}>
                <Save className="h-4 w-4 mr-1" /> {save.isPending ? "Salvando..." : "Salvar"}
              </Button>
              {step < STEPS.length - 1 ? (
                <Button onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>
                  Próximo <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button variant="default" onClick={() => window.print()}>
                  <Printer className="h-4 w-4 mr-1" /> Imprimir ficha
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumo visual */}
      {(isFilled("quem_e") || isFilled("dores") || isFilled("gatilhos")) && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-sm">📋 Ficha do ICP (resumo)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {isFilled("quem_e") && (
              <div>
                <Badge variant="outline">Quem é</Badge>
                <p className="mt-1 text-muted-foreground">
                  {[icp.quem_e.cargo_decisor, icp.quem_e.segmento, icp.quem_e.porte, icp.quem_e.geografia].filter(Boolean).join(" • ")}
                </p>
              </div>
            )}
            {isFilled("dores") && (
              <div>
                <Badge variant="outline">Dor principal</Badge>
                <p className="mt-1 text-muted-foreground">{icp.dores.principal}</p>
              </div>
            )}
            {isFilled("gatilhos") && (
              <div>
                <Badge variant="outline">Gatilho</Badge>
                <p className="mt-1 text-muted-foreground">{icp.gatilhos.evento}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
