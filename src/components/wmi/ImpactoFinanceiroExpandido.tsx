import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertTriangle, TrendingDown, TrendingUp, Flame, Skull, Target, Zap, ChevronRight,
  ShieldAlert, Calendar, Users, DollarSign, Settings2, RotateCcw, ChevronDown,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { calcularRevenueLeak, type RevenueLeak } from "@/hooks/useDiagnostico360";

interface Props {
  result: any;
}

const fmt = (n: number) => `R$ ${Math.round(n).toLocaleString("pt-BR")}`;
const parseBR = (v: string) => Number(v.replace(/[^\d]/g, "")) || 0;

function nivelRisco(percentual: number) {
  if (percentual < 50) return { label: "CRÍTICO", color: "from-rose-600 to-red-600", textColor: "text-rose-700",
    bg: "bg-rose-500/10 border-rose-500/40", icon: Skull,
    desc: "Sua operação está em risco de sobrevivência. Empresas nesse nível tendem a oscilar — não a crescer." };
  if (percentual < 70) return { label: "ALTO", color: "from-orange-500 to-rose-500", textColor: "text-orange-700",
    bg: "bg-orange-500/10 border-orange-500/40", icon: AlertTriangle,
    desc: "Crescimento instável e baixa previsibilidade. Você depende de sorte ou indicação para faturar." };
  if (percentual < 85) return { label: "MODERADO", color: "from-amber-500 to-yellow-500", textColor: "text-amber-700",
    bg: "bg-amber-500/10 border-amber-500/40", icon: ShieldAlert,
    desc: "Operação funcional, mas com gargalos que limitam o teto de faturamento." };
  return { label: "BAIXO", color: "from-emerald-500 to-green-500", textColor: "text-emerald-700",
    bg: "bg-emerald-500/10 border-emerald-500/40", icon: TrendingUp,
    desc: "Operação estruturada e previsível. Hora de escalar." };
}

export function ImpactoFinanceiroExpandido({ result }: Props) {
  const navigate = useNavigate();
  const leakBase: RevenueLeak | null =
    (result?.revenue_leak as RevenueLeak) || calcularRevenueLeak(result || {});

  const risco = nivelRisco(result?.percentual ?? 0);
  const RIcon = risco.icon;

  // ====== Defaults derivados do diagnóstico ======
  const defaultCaptacaoScore = useMemo(() => {
    if (!result?.pontuacoes) return null;
    const entries = Object.entries(result.pontuacoes as Record<string, number>);
    const prosp = entries.find(([k]) => /prospec|capta/i.test(k));
    return prosp ? (prosp[1] as number) : null;
  }, [result]);

  const defaults = useMemo(() => {
    const fatAtual = Number(result?.faturamento_atual) || 0;
    const meta = Number(result?.meta_faturamento) || 0;
    const gap = Math.max(0, meta - fatAtual);
    const perdaBase = leakBase?.perda_mensal ?? gap;
    const ticket = Number(result?.ticket_medio) || (fatAtual && perdaBase ? fatAtual / 5 : 1000);
    const mult = defaultCaptacaoScore !== null && defaultCaptacaoScore < 5
      ? (defaultCaptacaoScore < 3 ? 3 : 2) : 1;
    return {
      fatAtual, meta, ticket,
      perdaMensalBruta: perdaBase,
      multiplicador: mult,
      convLeadReuniao: 10,
      convReuniaoVenda: 20,
      recuperacaoMin: 30,
      recuperacaoMax: 70,
      horizonteMeses: 3,
    };
  }, [result, leakBase, defaultCaptacaoScore]);

  // ====== Estado editável ======
  const [fatAtual, setFatAtual] = useState(defaults.fatAtual);
  const [meta, setMeta] = useState(defaults.meta);
  const [ticket, setTicket] = useState(defaults.ticket);
  const [perdaMensalBruta, setPerdaMensalBruta] = useState(defaults.perdaMensalBruta);
  const [multiplicador, setMultiplicador] = useState(defaults.multiplicador);
  const [convLeadReuniao, setConvLeadReuniao] = useState(defaults.convLeadReuniao);
  const [convReuniaoVenda, setConvReuniaoVenda] = useState(defaults.convReuniaoVenda);
  const [recuperacaoRange, setRecuperacaoRange] = useState<[number, number]>([defaults.recuperacaoMin, defaults.recuperacaoMax]);
  const [horizonteMeses, setHorizonteMeses] = useState(defaults.horizonteMeses);
  const [openConfig, setOpenConfig] = useState(false);

  // Sincroniza quando o diagnóstico muda
  useEffect(() => {
    setFatAtual(defaults.fatAtual);
    setMeta(defaults.meta);
    setTicket(defaults.ticket);
    setPerdaMensalBruta(defaults.perdaMensalBruta);
    setMultiplicador(defaults.multiplicador);
    setConvLeadReuniao(defaults.convLeadReuniao);
    setConvReuniaoVenda(defaults.convReuniaoVenda);
    setRecuperacaoRange([defaults.recuperacaoMin, defaults.recuperacaoMax]);
    setHorizonteMeses(defaults.horizonteMeses);
  }, [defaults]);

  const restaurar = () => {
    setFatAtual(defaults.fatAtual);
    setMeta(defaults.meta);
    setTicket(defaults.ticket);
    setPerdaMensalBruta(defaults.perdaMensalBruta);
    setMultiplicador(defaults.multiplicador);
    setConvLeadReuniao(defaults.convLeadReuniao);
    setConvReuniaoVenda(defaults.convReuniaoVenda);
    setRecuperacaoRange([defaults.recuperacaoMin, defaults.recuperacaoMax]);
    setHorizonteMeses(defaults.horizonteMeses);
  };

  const editado = useMemo(() => (
    fatAtual !== defaults.fatAtual ||
    meta !== defaults.meta ||
    ticket !== defaults.ticket ||
    perdaMensalBruta !== defaults.perdaMensalBruta ||
    multiplicador !== defaults.multiplicador ||
    convLeadReuniao !== defaults.convLeadReuniao ||
    convReuniaoVenda !== defaults.convReuniaoVenda ||
    recuperacaoRange[0] !== defaults.recuperacaoMin ||
    recuperacaoRange[1] !== defaults.recuperacaoMax ||
    horizonteMeses !== defaults.horizonteMeses
  ), [fatAtual, meta, ticket, perdaMensalBruta, multiplicador, convLeadReuniao, convReuniaoVenda, recuperacaoRange, horizonteMeses, defaults]);

  // ====== Cálculos derivados ======
  const calc = useMemo(() => {
    const gap = Math.max(0, meta - fatAtual);
    const baseEffective = perdaMensalBruta || gap;
    const perdaMensalAjustada = baseEffective * multiplicador;
    const perdaDiaria = perdaMensalAjustada / 30;
    const perdaSemanal = perdaMensalAjustada / 4;
    const perdaAnual = perdaMensalAjustada * 12;
    const perdaHorizonte = perdaMensalAjustada * horizonteMeses;

    const tk = ticket > 0 ? ticket : 1;
    const vendasPerdidas = Math.ceil(perdaMensalAjustada / tk);
    const cRV = Math.max(convReuniaoVenda, 0.1) / 100;
    const cLR = Math.max(convLeadReuniao, 0.1) / 100;
    const reunioesPerdidas = Math.ceil(vendasPerdidas / cRV);
    const leadsNaoGerados = Math.ceil(reunioesPerdidas / cLR);

    const recMin = Math.round(perdaMensalAjustada * (recuperacaoRange[0] / 100));
    const recMax = Math.round(perdaMensalAjustada * (recuperacaoRange[1] / 100));
    const fatProjMin = fatAtual + recMin;
    const fatProjMax = fatAtual + recMax;

    return {
      gap, perdaMensalAjustada, perdaDiaria, perdaSemanal, perdaAnual, perdaHorizonte,
      vendasPerdidas, reunioesPerdidas, leadsNaoGerados,
      recMin, recMax, fatProjMin, fatProjMax,
    };
  }, [fatAtual, meta, ticket, perdaMensalBruta, multiplicador, convLeadReuniao, convReuniaoVenda, recuperacaoRange, horizonteMeses]);

  if (!leakBase && !calc.gap) return null;

  return (
    <div className="space-y-4">
      {/* Painel de ajuste removido — premissas já editáveis no card "Custo da Inação" acima */}
      {/* ====== NÍVEL DE RISCO ====== */}
      <Card className={`border-2 ${risco.bg} overflow-hidden`}>
        <div className={`h-1.5 bg-gradient-to-r ${risco.color}`} />
        <CardContent className="p-4 flex items-center gap-4 flex-wrap">
          <div className={`p-3 rounded-full bg-gradient-to-br ${risco.color} text-white`}>
            <RIcon className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Nível de risco da operação</div>
            <div className={`text-2xl font-black ${risco.textColor}`}>{risco.label}</div>
            <p className="text-xs text-muted-foreground mt-1">{risco.desc}</p>
          </div>
          {multiplicador > 1 && (
            <Badge className="bg-rose-600 text-white border-0 text-[11px]">
              ⚠️ Perda multiplicada por {multiplicador}x
            </Badge>
          )}
        </CardContent>
      </Card>

      {/* ====== RESUMO SIMPLIFICADO: QUANTO VOCÊ PERDE ====== */}
      <Card className="border-2 border-rose-500/40 overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-rose-700 via-rose-500 to-orange-500" />
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className="bg-rose-600 text-white border-0">💸 Quanto você perde</Badge>
            {editado && <Badge className="bg-amber-500 text-white border-0 text-[10px]">Cenário simulado</Badge>}
          </div>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-rose-500" />
            Sua perda em números simples
          </CardTitle>
          <CardDescription>Olhe direto para o valor mensal — é ele que define tudo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Destaque principal: perda mensal */}
          <div className="rounded-xl p-5 border-2 border-rose-600 bg-rose-600/10 text-center">
            <div className="text-xs uppercase font-bold text-rose-700 tracking-wider">Você está perdendo por mês</div>
            <div className="text-4xl lg:text-5xl font-black text-rose-700 mt-1">{fmt(calc.perdaMensalAjustada)}</div>
            <div className="text-xs text-muted-foreground mt-2">
              Equivale a <b>{fmt(calc.perdaDiaria)}</b> por dia • <b>{fmt(calc.perdaAnual)}</b> em 12 meses se nada mudar
            </div>
          </div>

          {/* Tradução em vendas */}
          <div className="rounded-lg p-4 bg-muted/40 border border-border">
            <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">Traduzindo em vendas</div>
            <p className="text-sm">
              Isso é o mesmo que deixar de fechar{" "}
              <b className="text-rose-700">{calc.vendasPerdidas.toLocaleString("pt-BR")} vendas/mês</b>{" "}
              (ticket médio de {fmt(ticket)}).
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ====== COMPARAÇÃO SIMPLES: HOJE vs COM WAZE ====== */}
      <div className="grid md:grid-cols-2 gap-3">
        <Card className="border-2 border-rose-500/40 bg-rose-500/5">
          <CardContent className="p-4 text-center space-y-1">
            <div className="flex items-center justify-center gap-2 text-rose-700 font-semibold text-sm">
              <TrendingDown className="h-4 w-4" /> Hoje (sem mudar nada)
            </div>
            <div className="text-2xl font-bold">{fmt(fatAtual)}<span className="text-xs text-muted-foreground">/mês</span></div>
            <div className="text-xs text-rose-700 font-medium">
              Perde {fmt(calc.perdaHorizonte)} em {horizonteMeses} meses
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-emerald-500/40 bg-emerald-500/5">
          <CardContent className="p-4 text-center space-y-1">
            <div className="flex items-center justify-center gap-2 text-emerald-700 font-semibold text-sm">
              <TrendingUp className="h-4 w-4" /> Com o Waze ativado
            </div>
            <div className="text-2xl font-bold text-emerald-700">
              {fmt(calc.fatProjMin)} <span className="text-sm font-normal">a</span> {fmt(calc.fatProjMax)}
            </div>
            <div className="text-xs text-emerald-700 font-medium">
              Recupera +{fmt(calc.recMin)} a +{fmt(calc.recMax)} por mês
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ====== CONCLUSÃO + CTA (curta) ====== */}
      <Card className="border-2 border-primary/40 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start gap-2">
            <Flame className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <p className="text-sm leading-relaxed">
              Resumo: você perde <b className="text-rose-600">{fmt(calc.perdaMensalAjustada)}/mês</b> por falta de processo.
              Com o Waze, recupera entre <b className="text-emerald-600">{fmt(calc.recMin)}</b> e{" "}
              <b className="text-emerald-600">{fmt(calc.recMax)}</b> por mês.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={() => navigate("/prospeccao")} className="gap-2 flex-1">
              <Target className="h-4 w-4" /> Começar pela Prospecção <ChevronRight className="h-4 w-4" />
            </Button>
            <Button onClick={() => navigate("/processos")} variant="outline" className="gap-2 flex-1">
              <Zap className="h-4 w-4" /> Estruturar processo
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
