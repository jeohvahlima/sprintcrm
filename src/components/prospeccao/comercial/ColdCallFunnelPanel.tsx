import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, CheckCircle2, TrendingUp } from "lucide-react";

const FUNNEL_STAGES = [
  { num: 1, name: "Lista Fria", sub: "Leads importados / gerados por IA", count: 1200, pct: 100, color: "blue" },
  { num: 2, name: "Tentativa de Contato", sub: "1ª a 3ª ligação realizada", count: 744, pct: 62, color: "purple" },
  { num: 3, name: "Conectou", sub: "Decisor atendeu · pitch realizado", count: 216, pct: 18, color: "amber" },
  { num: 4, name: "Interesse Demonstrado", sub: "Lead pediu mais informações / demo", count: 108, pct: 9, color: "cyan" },
  { num: 5, name: "Reunião Agendada", sub: "Compromisso confirmado no calendário", count: 48, pct: 4, color: "green" },
  { num: 6, name: "Proposta Enviada", sub: "Follow-up de proposta em andamento", count: 24, pct: 2, color: "emerald" },
  { num: 7, name: "Fechado / Ganho", sub: "Venda concluída · cliente ativo", count: 11, pct: 1, color: "teal" },
];

const colorMap: Record<string, string> = {
  blue: "from-blue-400 to-blue-600 text-blue-600",
  purple: "from-purple-400 to-purple-600 text-purple-600",
  amber: "from-amber-400 to-amber-600 text-amber-600",
  cyan: "from-cyan-400 to-cyan-600 text-cyan-600",
  green: "from-green-400 to-green-600 text-green-600",
  emerald: "from-emerald-400 to-emerald-600 text-emerald-600",
  teal: "from-teal-400 to-teal-600 text-teal-600",
};

const bgColorMap: Record<string, string> = {
  blue: "bg-blue-50 dark:bg-blue-950/30",
  purple: "bg-purple-50 dark:bg-purple-950/30",
  amber: "bg-amber-50 dark:bg-amber-950/30",
  cyan: "bg-cyan-50 dark:bg-cyan-950/30",
  green: "bg-green-50 dark:bg-green-950/30",
  emerald: "bg-emerald-50 dark:bg-emerald-950/30",
  teal: "bg-teal-50 dark:bg-teal-950/30",
};

export function ColdCallFunnelPanel() {
  return (
    <div className="space-y-6">
      {/* Insight */}
      <div className="flex gap-3 p-4 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-950/20">
        <div className="text-lg flex-shrink-0">🤖</div>
        <div className="text-sm text-foreground">
          <strong>IA detectou:</strong> sua taxa de conexão (18%) está 8% abaixo do benchmark do setor. Melhor horário para ligar:{" "}
          <strong>terças 10h–12h</strong> e <strong>quintas 15h–17h</strong>. Tente o segmento <strong>Clínicas Médicas</strong> — score de fit
          92/100.
        </div>
      </div>

      {/* Funnel */}
      <Card className="rounded-xl">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">📊 Funil de Prospecção Cold Call</CardTitle>
            <div className="flex gap-2">
              {["Visão geral", "Por vendedor", "Por segmento"].map((view) => (
                <button
                  key={view}
                  className="px-3 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition first:bg-primary first:text-white first:hover:bg-primary-dark"
                >
                  {view}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Funnel steps */}
          <div className="space-y-3">
            {FUNNEL_STAGES.map((stage) => (
              <div key={stage.num} className={`p-3 rounded-lg border border-border hover:border-slate-400 transition ${bgColorMap[stage.color]}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${colorMap[stage.color]} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>
                    {stage.num}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{stage.name}</div>
                    <div className="text-xs text-muted-foreground">{stage.sub}</div>
                  </div>
                  <div className="flex-shrink-0 min-w-fit flex gap-4 items-center">
                    <div className="w-32 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className={`h-full bg-gradient-to-r ${colorMap[stage.color]} transition-all`} style={{ width: `${stage.pct}%` }} />
                    </div>
                    <div className="text-right min-w-16">
                      <div className="text-sm font-bold">{stage.count}</div>
                      <div className="text-xs text-muted-foreground">{stage.pct}%</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-3 gap-3 mt-6 pt-6 border-t border-border">
            <div className="text-center">
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Taxa de discagem</div>
              <div className="text-2xl font-bold text-blue-600 mt-2">62%</div>
            </div>
            <div className="text-center">
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Taxa de conexão</div>
              <div className="text-2xl font-bold text-amber-600 mt-2">18%</div>
            </div>
            <div className="text-center">
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Conversão p/ reunião</div>
              <div className="text-2xl font-bold text-green-600 mt-2">9%</div>
            </div>
          </div>

          {/* Warning */}
          <div className="flex gap-3 p-4 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20 mt-6">
            <div className="text-lg flex-shrink-0">⚠️</div>
            <div className="text-sm text-foreground">
              <strong>Gargalo identificado:</strong> etapa "Conectou → Interesse" com queda de 50%. Revise o pitch. Use o script sugerido pela IA
              para aumentar em <strong>+12pp</strong> a taxa de interesse.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Queue */}
      <Card className="rounded-xl">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">📋 Fila de ligações — hoje</CardTitle>
            <div className="flex gap-2">
              <button className="px-3 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition">
                🔍 Filtrar
              </button>
              <button className="px-3 py-1 text-xs font-semibold rounded-lg bg-primary text-white hover:bg-primary/90 transition">
                🤖 Ordenado por IA
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-1 divide-y divide-border">
            {[
              { name: "Clínica Saúde Total", sub: "Dr. Marcos Lima · (11) 99234-5678 · Score IA: 87", status: "Novo", bg: "bg-blue-500", initials: "CT" },
              { name: "Odontoclínica Del Rey", sub: "Dra. Sofia · (11) 97654-3210 · Score IA: 81", status: "2ª tentativa", bg: "bg-purple-500", initials: "OD" },
              { name: "PsicoSol Psicologia", sub: "Coord. Renata · (21) 98765-0001 · Score IA: 79", status: "Conectado", bg: "bg-emerald-600", initials: "PS" },
              { name: "FisioMais Reabilitação", sub: "Gustavo Dir. · (11) 91234-0089 · Score IA: 76", status: "3ª tentativa", bg: "bg-amber-600", initials: "FM" },
              { name: "Lab Sante Diagnósticos", sub: "Resp. Paulo · (31) 94567-2233 · Score IA: 72", status: "Novo", bg: "bg-cyan-600", initials: "LS" },
            ].map((item, idx) => (
              <div key={idx} className="py-3 flex items-center gap-3 hover:bg-accent/50 transition px-2 rounded">
                <div className={`w-10 h-10 rounded-lg ${item.bg} text-white flex items-center justify-center text-xs font-bold flex-shrink-0`}>
                  {item.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{item.name}</div>
                  <div className="text-xs text-muted-foreground">{item.sub}</div>
                </div>
                <Badge
                  variant="outline"
                  className={`text-xs font-semibold flex-shrink-0 ${
                    item.status === "Novo"
                      ? "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900"
                      : item.status === "Conectado"
                        ? "bg-green-50 text-green-600 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-900"
                        : "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900"
                  }`}
                >
                  {item.status}
                </Badge>
                <button className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-primary hover:text-white dark:bg-slate-800 flex items-center justify-center text-sm transition">
                  📞
                </button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
