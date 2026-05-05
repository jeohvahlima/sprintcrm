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

      {/* ====== PERDA EM 4 LINHAS DO TEMPO ====== */}
      <Card className="border-2 border-rose-500/40 overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-rose-700 via-rose-500 to-orange-500" />
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className="bg-rose-600 text-white border-0">💸 Quanto você está perdendo</Badge>
            {multiplicador > 1 && <Badge variant="outline" className="text-[10px]">Ajuste {multiplicador}x por captação fraca</Badge>}
            {editado && <Badge className="bg-amber-500 text-white border-0 text-[10px]">Cenário simulado</Badge>}
          </div>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-rose-500" />
            Linha do tempo da hemorragia financeira
          </CardTitle>
          <CardDescription>Cada dia parado é dinheiro indo embora.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "POR DIA", value: calc.perdaDiaria, sub: "≈ a cada 24h", icon: "🔥" },
              { label: "POR SEMANA", value: calc.perdaSemanal, sub: "5 dias úteis", icon: "📉" },
              { label: "POR MÊS", value: calc.perdaMensalAjustada, sub: "fechamento mensal", icon: "💔" },
              { label: "EM 12 MESES", value: calc.perdaAnual, sub: "se nada mudar", icon: "💀", big: true },
            ].map((it) => (
              <div key={it.label} className={`rounded-lg p-3 border-2 ${it.big ? "border-rose-600 bg-rose-600/15" : "border-rose-500/30 bg-rose-500/5"}`}>
                <div className="text-[10px] uppercase font-bold text-rose-700">{it.icon} {it.label}</div>
                <div className={`font-black text-rose-700 ${it.big ? "text-2xl lg:text-3xl" : "text-xl lg:text-2xl"}`}>
                  {fmt(it.value)}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">{it.sub}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ====== CUSTOS INVISÍVEIS ====== */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            ⚠️ Custos invisíveis da sua operação
          </CardTitle>
          <CardDescription>O que você está deixando de gerar todos os meses por falta de estrutura.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="rounded-lg p-3 bg-amber-500/5 border border-amber-500/30">
              <Users className="h-5 w-5 text-amber-600 mb-1" />
              <div className="text-2xl font-bold text-amber-700">{calc.leadsNaoGerados.toLocaleString("pt-BR")}</div>
              <div className="text-xs font-semibold">leads não gerados/mês</div>
              <div className="text-[10px] text-muted-foreground mt-1">considerando {convLeadReuniao}% lead → reunião</div>
            </div>
            <div className="rounded-lg p-3 bg-orange-500/5 border border-orange-500/30">
              <Calendar className="h-5 w-5 text-orange-600 mb-1" />
              <div className="text-2xl font-bold text-orange-700">{calc.reunioesPerdidas.toLocaleString("pt-BR")}</div>
              <div className="text-xs font-semibold">reuniões perdidas/mês</div>
              <div className="text-[10px] text-muted-foreground mt-1">considerando {convReuniaoVenda}% reunião → venda</div>
            </div>
            <div className="rounded-lg p-3 bg-rose-500/5 border border-rose-500/30">
              <DollarSign className="h-5 w-5 text-rose-600 mb-1" />
              <div className="text-2xl font-bold text-rose-700">{calc.vendasPerdidas.toLocaleString("pt-BR")}</div>
              <div className="text-xs font-semibold">vendas não realizadas/mês</div>
              <div className="text-[10px] text-muted-foreground mt-1">ticket médio {fmt(ticket)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ====== CENÁRIOS LADO A LADO ====== */}
      <div className="grid md:grid-cols-2 gap-3">
        <Card className="border-2 border-rose-500/40 bg-gradient-to-br from-rose-500/5 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-rose-700">
              <TrendingDown className="h-5 w-5" />
              📉 Se nada mudar nos próximos {horizonteMeses} {horizonteMeses === 1 ? "mês" : "meses"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-xs text-muted-foreground">Faturamento mantido (estagnação)</div>
            <div className="text-2xl font-bold">{fmt(fatAtual)}<span className="text-xs text-muted-foreground">/mês</span></div>
            <div className="border-t pt-2 mt-2">
              <div className="text-xs text-rose-700 font-semibold">Perda acumulada em {horizonteMeses} meses</div>
              <div className="text-3xl font-black text-rose-700">{fmt(calc.perdaHorizonte)}</div>
              <p className="text-[11px] text-muted-foreground mt-1 italic">
                "Empresas que não estruturam o comercial não estagnam — elas regridem."
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-500/5 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-emerald-700">
              <TrendingUp className="h-5 w-5" />
              📈 Com a estrutura comercial implementada
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-xs text-muted-foreground">Faturamento projetado ({horizonteMeses} meses)</div>
            <div className="text-2xl font-bold text-emerald-700">
              {fmt(calc.fatProjMin)} <span className="text-sm">a</span> {fmt(calc.fatProjMax)}
            </div>
            <div className="border-t pt-2 mt-2">
              <div className="text-xs text-emerald-700 font-semibold">Recuperação mensal estimada</div>
              <div className="text-3xl font-black text-emerald-700">+{fmt(calc.recMin)}–{fmt(calc.recMax)}</div>
              <p className="text-[11px] text-muted-foreground mt-1 italic">
                Recuperação típica: {recuperacaoRange[0]}% a {recuperacaoRange[1]}% do gap com execução disciplinada.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ====== CONCLUSÃO ESTRATÉGICA + CTA ====== */}
      <Card className="border-2 border-primary/40 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Flame className="h-5 w-5 text-primary" />
            🚀 Conclusão Estratégica
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm leading-relaxed">
            Hoje sua empresa não cresce por falta de ferramenta — ela cresce <b>abaixo do potencial</b> por <b>ausência de processo estruturado de geração de demanda</b>.
            Você está deixando <span className="font-bold text-rose-600">{fmt(calc.perdaMensalAjustada)} por mês</span> na mesa
            — o equivalente a <span className="font-bold text-rose-600">{fmt(calc.perdaDiaria)} todos os dias úteis</span>.
          </p>
          <p className="text-sm leading-relaxed">
            Com os módulos do <b>Waze</b> ativados (Prospecção, Cadências, Funil, IA, Discador, Analytics),
            você pode recuperar entre <span className="font-bold text-emerald-600">{fmt(calc.recMin)}</span> e
            <span className="font-bold text-emerald-600"> {fmt(calc.recMax)}</span> por mês nos próximos {horizonteMeses} meses.
          </p>
          <div className="rounded-lg p-3 bg-foreground/5 border border-foreground/10 text-sm font-semibold italic text-center">
            "O problema não é crescer. O problema é parar de perder {fmt(calc.perdaDiaria)}/dia."
          </div>
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button onClick={() => navigate("/prospeccao")} className="gap-2 flex-1">
              <Target className="h-4 w-4" /> Resolver agora em Prospecção <ChevronRight className="h-4 w-4" />
            </Button>
            <Button onClick={() => navigate("/processos")} variant="outline" className="gap-2 flex-1">
              <Zap className="h-4 w-4" /> Estruturar processo comercial
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
