import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertCircle, Zap } from "lucide-react";

const SUGGESTIONS = ["🏥 Clínicas médicas", "⚖️ Advocacia", "💻 SaaS", "🏠 Imobiliárias"];

const RESULTS = [
  { name: "ClínicaMax Saúde", city: "São Paulo", employees: 45, score: 92, label: "🔥 HOT", color: "red" },
  { name: "DrMed Clínica Integrada", city: "Curitiba", employees: 32, score: 88, label: "🔥 HOT", color: "red" },
  { name: "HealthCare São Paulo", city: "São Paulo", employees: 67, score: 79, label: "🟡 WARM", color: "amber" },
  { name: "Clínica Popular Saúde", city: "Rio de Janeiro", employees: 25, score: 65, label: "❄️ COLD", color: "blue" },
];

export function ProspectingIntelligencePanel() {
  const [niche, setNiche] = useState("Clínicas médicas");
  const [activeTab, setActiveTab] = useState<"analysis" | "icps" | "pipeline">("analysis");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🤖</span>
          <h2 className="text-2xl font-bold">Análise Inteligente de Mercado</h2>
        </div>
        <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
          Powered by GPT-4 + OpenAI API
        </Badge>
      </div>

      {/* Input Section */}
      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="text-base">Qual nicho/segmento você quer analisar?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder="Ex: Clínicas médicas, Agências de marketing..."
              className="flex-1"
            />
            <Button className="bg-blue-600 hover:bg-blue-700 text-white">
              <Zap className="w-4 h-4 mr-2" />
              Analisar
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((sug) => (
              <button
                key={sug}
                onClick={() => setNiche(sug.split(" ")[1] + " " + sug.split(" ").slice(2).join(" "))}
                className="px-3 py-2 text-xs font-semibold rounded-lg border border-border hover:bg-accent transition"
              >
                {sug}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        {[
          { id: "analysis", label: "📊 Análise de Mercado", icon: "📊" },
          { id: "icps", label: "🎯 ICP Identificado", icon: "🎯" },
          { id: "pipeline", label: "🔀 Distribuição por Score", icon: "🔀" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-3 text-sm font-semibold transition border-b-2 ${
              activeTab === tab.id
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === "analysis" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              { label: "Empresas no nicho", value: "12.453", trend: "+23%" },
              { label: "ICP Match %", value: "34%", trend: "+8pp" },
              { label: "Ticket médio", value: "R$ 145k", trend: "→" },
              { label: "Oportunidades HOT", value: "342", trend: "+12%" },
            ].map((item) => (
              <Card key={item.label} className="rounded-lg p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground font-bold">{item.label}</div>
                <div className="text-3xl font-black mt-2">{item.value}</div>
                <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">{item.trend}</div>
              </Card>
            ))}
          </div>

          <div className="p-4 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-950/20">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="text-sm text-foreground">Insight IA:</strong>
                <p className="text-sm text-foreground mt-1">
                  Clínicas médicas em SP têm 3x mais propensão a comprar SaaS de prospecção. Você já tem score de fit de 92/100 com essa base.
                  Recomendamos: aumentar volume de ligações 2x, usar o script "Agenda de procedimentos" e focar em dentistas (ROI +85%).
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "icps" && (
        <div className="space-y-4">
          {RESULTS.map((result) => (
            <Card key={result.name} className="rounded-lg p-4 hover:bg-accent/30 transition">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-foreground">{result.name}</span>
                    <Badge className={`text-xs font-semibold ${
                      result.color === "red"
                        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        : result.color === "amber"
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                          : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                    }`}>
                      {result.label}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">{result.city} • {result.employees} funcionários</div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-black text-blue-600">{result.score}</div>
                  <div className="text-xs text-muted-foreground">/ 100</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {activeTab === "pipeline" && (
        <div className="space-y-4">
          {[
            { label: "🔥 HOT (80-100)", count: 342, pct: 18 },
            { label: "🟡 WARM (50-79)", count: 1456, pct: 52 },
            { label: "❄️ COLD (0-49)", count: 655, pct: 30 },
          ].map((item) => (
            <div key={item.label} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{item.label}</span>
                <span className="text-sm text-muted-foreground">{item.count} empresas • {item.pct}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div
                  className={`h-full ${
                    item.label.startsWith("🔥") ? "bg-red-500" : item.label.startsWith("🟡") ? "bg-amber-500" : "bg-blue-500"
                  }`}
                  style={{ width: `${item.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
