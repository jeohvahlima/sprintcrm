import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  ShieldAlert, ShieldCheck, AlertTriangle, TrendingUp,
  Crown, Activity, Gauge, Briefcase,
} from "lucide-react";
import type { DiagnosticoResposta, Alavanca } from "@/hooks/useDiagnostico360";
import { cn } from "@/lib/utils";

interface Props {
  result: DiagnosticoResposta;
  alavancas: Alavanca[];
}

type RiscoLevel = "baixo" | "atencao" | "instavel" | "critico";

const RISCO: Record<RiscoLevel, { label: string; emoji: string; cor: string; border: string; bg: string; texto: string }> = {
  baixo: {
    label: "BAIXO RISCO",
    emoji: "🟢",
    cor: "text-emerald-600",
    border: "border-emerald-500/40",
    bg: "from-emerald-500/10 to-emerald-500/5",
    texto: "Operação saudável, com previsibilidade acima da média. Foque em escala.",
  },
  atencao: {
    label: "ATENÇÃO",
    emoji: "🟡",
    cor: "text-amber-600",
    border: "border-amber-500/40",
    bg: "from-amber-500/10 to-amber-500/5",
    texto: "Operação funcional, mas com pontos cegos que travam o crescimento.",
  },
  instavel: {
    label: "OPERAÇÃO INSTÁVEL",
    emoji: "🟠",
    cor: "text-orange-600",
    border: "border-orange-500/40",
    bg: "from-orange-500/10 to-orange-500/5",
    texto: "Resultado depende mais do esforço pessoal do que do método. Receita oscila.",
  },
  critico: {
    label: "RISCO DE ESTAGNAÇÃO COMERCIAL",
    emoji: "🔴",
    cor: "text-rose-600",
    border: "border-rose-500/40",
    bg: "from-rose-500/15 to-rose-500/5",
    texto: "Sua empresa está deixando muito dinheiro na mesa todos os dias. Ação imediata é necessária.",
  },
};

function calcularRisco(pct: number): RiscoLevel {
  if (pct >= 80) return "baixo";
  if (pct >= 60) return "atencao";
  if (pct >= 40) return "instavel";
  return "critico";
}

export function ResumoExecutivoConsultivo({ result, alavancas }: Props) {
  const al4 = alavancas.find((a) => a.numero === 4);
  const al5 = alavancas.find((a) => a.numero === 5);
  const score4 = al4 ? result.pontuacoes?.[al4.id] || 0 : 0;
  const score5 = al5 ? result.pontuacoes?.[al5.id] || 0 : 0;

  // Métricas executivas derivadas
  const previsibilidade = Math.round((score5 / 10) * 100);
  const dependenciaDono = Math.round(100 - (score4 / 10) * 100);
  const capacidadeUso = result.revenue_leak?.capacidade_uso_pct ?? Math.min(100, result.percentual);
  const capacidadeOciosa = Math.max(0, 100 - capacidadeUso);

  const risco = calcularRisco(result.percentual);
  const r = RISCO[risco];

  // Resumo executivo dinâmico
  const fat = result.faturamento_atual;
  const meta = result.meta_faturamento;
  const gap = fat && meta && meta > fat ? meta - fat : 0;
  const perda = result.revenue_leak?.perda_mensal || 0;

  const resumo = (() => {
    const parts: string[] = [];
    parts.push(
      `Sua empresa possui potencial comercial${meta ? ` para faturar até R$ ${Math.round(meta).toLocaleString("pt-BR")}/mês` : ""}, porém hoje opera com **${previsibilidade}% de previsibilidade**, **${dependenciaDono}% de dependência do dono** e usa apenas **${capacidadeUso}% da capacidade comercial real**.`
    );
    if (perda > 0) {
      parts.push(
        `A operação atual está deixando aproximadamente **R$ ${Math.round(perda).toLocaleString("pt-BR")}/mês** em receita não capturada — perdas invisíveis por falta de follow-up, baixa frequência de prospecção e ausência de rotina comercial estruturada.`
      );
    }
    if (gap > 0) {
      parts.push(
        `O GAP até a meta é de **R$ ${Math.round(gap).toLocaleString("pt-BR")}/mês**, viável apenas com correção dos gargalos críticos identificados nas alavancas mais fracas.`
      );
    }
    if (risco === "critico") {
      parts.push("Sem intervenção estruturada nos próximos 60–90 dias, há **risco real de estagnação comercial** mesmo com investimento em marketing.");
    }
    return parts.join(" ");
  })();

  const formatRich = (txt: string) =>
    txt.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
      p.startsWith("**") ? (
        <strong key={i} className="text-foreground">{p.slice(2, -2)}</strong>
      ) : (
        <span key={i}>{p}</span>
      )
    );

  return (
    <Card className={cn("border-2 overflow-hidden", r.border)}>
      <div className={cn("h-2 bg-gradient-to-r", r.bg.replace(/from-([^\s]+).*to-([^\s]+)/, "from-$1 to-$2"))} />
      <CardContent className="p-6 space-y-5">
        {/* HEADER consultivo */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className={cn("p-2.5 rounded-xl bg-gradient-to-br", r.bg, r.cor)}>
              <Briefcase className="h-6 w-6" />
            </div>
            <div>
              <Badge variant="outline" className="text-[10px] mb-1">RESUMO EXECUTIVO · Análise Estratégica</Badge>
              <h3 className="text-lg font-bold leading-tight">Diagnóstico Consultivo da Operação Comercial</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Análise de risco, previsibilidade e dependência operacional.</p>
            </div>
          </div>

          <div className={cn("border-2 rounded-xl px-4 py-2 bg-gradient-to-br text-center", r.border, r.bg)}>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Nível de Risco</div>
            <div className={cn("text-base font-bold mt-0.5", r.cor)}>
              {r.emoji} {r.label}
            </div>
          </div>
        </div>

        {/* Texto consultivo */}
        <div className="text-sm leading-relaxed text-muted-foreground bg-muted/30 border rounded-lg p-4">
          {formatRich(resumo)}
        </div>

        <p className={cn("text-xs italic", r.cor)}>{r.texto}</p>

        {/* 4 medidores estratégicos */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Previsibilidade */}
          <MedidorCard
            icon={Gauge}
            label="Previsibilidade Comercial"
            valor={previsibilidade}
            cor={previsibilidade >= 70 ? "emerald" : previsibilidade >= 40 ? "amber" : "rose"}
            interpretacao={
              previsibilidade >= 70
                ? "Operação previsível: você prevê crescimento."
                : previsibilidade >= 40
                ? "Previsibilidade parcial. Resultado ainda oscila."
                : "Sem previsibilidade clara de crescimento."
            }
          />
          {/* Dependência do dono */}
          <MedidorCard
            icon={Crown}
            label="Dependência do Dono"
            valor={dependenciaDono}
            invertido
            cor={dependenciaDono <= 30 ? "emerald" : dependenciaDono <= 60 ? "amber" : "rose"}
            interpretacao={
              dependenciaDono <= 30
                ? "Operação independente do dono."
                : dependenciaDono <= 60
                ? "Empresa depende parcialmente do dono."
                : "Empresa para se você sair 15 dias."
            }
          />
          {/* Capacidade em uso */}
          <MedidorCard
            icon={Activity}
            label="Capacidade Comercial em Uso"
            valor={capacidadeUso}
            cor={capacidadeUso >= 70 ? "emerald" : capacidadeUso >= 40 ? "amber" : "rose"}
            interpretacao={`${capacidadeOciosa}% do potencial está desperdiçado hoje.`}
          />
          {/* Score geral */}
          <MedidorCard
            icon={TrendingUp}
            label="Maturidade Comercial"
            valor={result.percentual}
            cor={result.percentual >= 70 ? "emerald" : result.percentual >= 50 ? "amber" : "rose"}
            interpretacao={`Nota ${result.nota} · ${result.total_score} pontos.`}
          />
        </div>
      </CardContent>
    </Card>
  );
}

interface MedidorProps {
  icon: any;
  label: string;
  valor: number;
  cor: "emerald" | "amber" | "rose";
  interpretacao: string;
  invertido?: boolean;
}

function MedidorCard({ icon: Icon, label, valor, cor, interpretacao }: MedidorProps) {
  const corMap = {
    emerald: { text: "text-emerald-600", bg: "from-emerald-500/10 to-transparent", border: "border-emerald-500/30", iconBg: "bg-emerald-500/10" },
    amber: { text: "text-amber-600", bg: "from-amber-500/10 to-transparent", border: "border-amber-500/30", iconBg: "bg-amber-500/10" },
    rose: { text: "text-rose-600", bg: "from-rose-500/10 to-transparent", border: "border-rose-500/30", iconBg: "bg-rose-500/10" },
  }[cor];

  return (
    <div className={cn("border rounded-lg p-3 bg-gradient-to-br space-y-2", corMap.border, corMap.bg)}>
      <div className="flex items-center gap-2">
        <div className={cn("p-1.5 rounded-md", corMap.iconBg, corMap.text)}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium leading-tight">{label}</div>
      </div>
      <div className="flex items-baseline gap-1">
        <span className={cn("text-3xl font-bold", corMap.text)}>{valor}</span>
        <span className="text-xs text-muted-foreground">%</span>
      </div>
      <Progress value={valor} className="h-1.5" />
      <p className="text-[11px] text-muted-foreground leading-tight">{interpretacao}</p>
    </div>
  );
}
