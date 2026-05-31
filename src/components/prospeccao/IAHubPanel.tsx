import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Search, Sparkles, Target, ShieldCheck, ArrowRight, TrendingUp } from "lucide-react";
import { SalesMachineWizard } from "./SalesMachineWizard";

const SUGGESTIONS = [
  "Clínicas médicas de pequeno e médio porte",
  "Escritórios de advocacia tributária",
  "SaaS B2B early-stage",
  "Imobiliárias de alto padrão",
];

const makeAnalysis = (niche: string) => ({
  title: `Perfil ICP gerado para: ${niche}`,
  details: [
    { label: "Decisor", value: "CEO / Dono / Diretor Clínico" },
    { label: "Porte ideal", value: "10–100 funcionários" },
    { label: "Receita média", value: "R$ 50k–300k/mês" },
    { label: "Score mínimo", value: "65/100" },
  ],
  dores: [
    "Gestão manual de leads",
    "Falta de CRM",
    "WhatsApp desorganizado",
    "Alta taxa de no-show",
  ],
  abertura:
    "Vocês estão perdendo em média R$ 15.000/mês em leads que chegam pelo WhatsApp e não são acompanhados. Nossa solução recuperou isso para clínicas similares em 30 dias.",
});

export function IAHubPanel() {
  const [niche, setNiche] = useState("Clínicas médicas de pequeno e médio porte em São Paulo...");
  const [analysis, setAnalysis] = useState<ReturnType<typeof makeAnalysis> | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalyze = () => {
    setIsAnalyzing(true);
    setAnalysis(null);
    window.setTimeout(() => {
      setAnalysis(makeAnalysis(niche || "Clínicas médicas"));
      setIsAnalyzing(false);
    }, 1200);
  };

  const scoreSummary = useMemo(() => {
    if (!analysis) return null;
    return {
      hot: 48,
      warm: 132,
      cold: 284,
      out: 736,
    };
  }, [analysis]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
        <Card className="border-border bg-gradient-to-br from-purple-50 to-white">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">🤖 Análise IA — Perfil de Empresas (ICP)</CardTitle>
              <CardDescription>A IA analisa empresas e gera score de fit, dores identificadas e melhor abordagem.</CardDescription>
            </div>
            <Badge className="bg-purple-100 text-purple-700">IA POWERED</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <Input
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder="Ex: Clínicas médicas de pequeno e médio porte em São Paulo..."
              />
              <Button onClick={handleAnalyze} disabled={isAnalyzing}>
                {isAnalyzing ? "Analisando..." : "🔍 Analisar ICP"}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((item) => (
                <Button key={item} variant="outline" size="sm" onClick={() => setNiche(item)}>
                  {item}
                </Button>
              ))}
            </div>

            <div className="rounded-3xl border border-purple-200 bg-white p-4 text-slate-700">
              {analysis ? (
                <div className="space-y-4">
                  <div className="text-sm font-semibold text-purple-800">{analysis.title}</div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {analysis.details.map((item) => (
                      <div key={item.label} className="rounded-2xl border border-slate-200 p-3">
                        <div className="text-[11px] uppercase tracking-[.18em] text-slate-500">{item.label}</div>
                        <div className="mt-2 font-semibold text-slate-900">{item.value}</div>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-[.18em] text-slate-500 mb-2">Principais dores identificadas</div>
                    <div className="flex flex-wrap gap-2">
                      {analysis.dores.map((pain) => (
                        <Badge key={pain} className="bg-emerald-50 text-emerald-700">{pain}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-purple-200 bg-purple-50 p-4 text-slate-700">
                    <div className="text-sm font-semibold text-purple-800 mb-2">Melhor abordagem de abertura</div>
                    <p className="text-sm">{analysis.abertura}</p>
                  </div>
                </div>
              ) : (
                <div className="text-center text-sm text-slate-500 py-12">
                  🔍 Insira um nicho acima para analisar.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base">📋 ICP definido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              <div><strong className="text-slate-900">Segmento:</strong> Saúde · Clínicas</div>
              <div><strong className="text-slate-900">Porte:</strong> 10–100 funcionários</div>
              <div><strong className="text-slate-900">Cargo decisor:</strong> Diretor / CEO / Proprietário</div>
              <div><strong className="text-slate-900">Dores:</strong> gestão de leads, agenda manual, sem CRM</div>
              <div><strong className="text-slate-900">Triggers:</strong> abertura de filial, contratação, crescimento</div>
              <div><strong className="text-slate-900">Score mínimo:</strong> <span className="text-emerald-700">70/100</span></div>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base">📊 Score do pipeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              <div className="flex justify-between"><span>🔥 Score 80–100 (Hot)</span><span className="text-emerald-700 font-semibold">48 leads</span></div>
              <div className="flex justify-between"><span>🟡 Score 60–79 (Warm)</span><span className="text-amber-700 font-semibold">132 leads</span></div>
              <div className="flex justify-between"><span>🔵 Score 40–59 (Cold)</span><span className="font-semibold">284 leads</span></div>
              <div className="flex justify-between"><span>❌ Abaixo do ICP</span><span className="text-red-600 font-semibold">736 leads</span></div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="border-border bg-slate-50">
        <CardHeader>
          <CardTitle className="text-base">📈 Máquina de Vendas</CardTitle>
          <CardDescription>Use o diagnóstico de ICP para montar a cadência e a execução comercial.</CardDescription>
        </CardHeader>
        <CardContent>
          <SalesMachineWizard />
        </CardContent>
      </Card>
    </div>
  );
}
